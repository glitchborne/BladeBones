"""Task 03 real-browser acceptance; served root and browser are always released."""

import argparse
import json
import struct
import sys
import zlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def create_artwork(path):
    """Small synthetic imported PNG; no external art or imaging dependency."""
    width, height = 220, 320
    regions = [
        ((70, 15, 150, 90), (228, 183, 107, 255)),
        ((66, 100, 154, 220), (91, 144, 188, 255)),
        ((25, 104, 58, 230), (228, 183, 107, 255)),
        ((162, 104, 195, 230), (228, 183, 107, 255)),
        ((70, 226, 104, 307), (77, 100, 123, 255)),
        ((116, 226, 150, 307), (77, 100, 123, 255)),
        ((86, 44, 94, 52), (38, 55, 71, 255)),
        ((126, 44, 134, 52), (38, 55, 71, 255)),
    ]
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            pixel = (0, 0, 0, 0)
            for (left, top, right, bottom), color in regions:
                if left <= x <= right and top <= y <= bottom:
                    pixel = color
            rows.extend(pixel)

    def chunk(kind, payload):
        return struct.pack('!I', len(payload)) + kind + payload + struct.pack('!I', zlib.crc32(kind + payload))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
    path.write_bytes(png)


def run(root, artifacts):
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    report = {'errors': [], 'checks': [], 'sizes': [], 'screenshots': []}
    artifacts.mkdir(parents=True, exist_ok=True)
    create_artwork(artifacts / 'workflow-art.png')

    def check(condition, message):
        assert condition, message
        report['checks'].append(message)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1600, 'height': 900}, device_scale_factor=1)
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.on('dialog', lambda dialog: dialog.accept('Idle') if dialog.type == 'prompt' else dialog.accept())
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
            page.wait_for_function("document.querySelector('.app').dataset.workflowReady === 'true'")

            def mode(name):
                page.locator(f'[data-workflow-mode="{name}"]').click()
                page.wait_for_function('(name) => document.querySelector(".app").dataset.workflow === name', arg=name)
                page.wait_for_timeout(100)

            def click_control(selector):
                target = page.locator(selector)
                for disclosure in target.locator('xpath=ancestor::details').all():
                    if disclosure.get_attribute('open') is None:
                        disclosure.locator(':scope > summary').click()
                target.click()

            def screenshot(name):
                path = artifacts / f'{name}.png'
                page.screenshot(path=str(path))
                report['screenshots'].append(str(path))

            def fit(label):
                box = page.locator('#canvas').bounding_box()
                viewport = page.viewport_size
                check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{label}: no body overflow')
                check(box['width'] >= 600 and box['height'] >= 250, f'{label}: useful viewport size')
                report['sizes'].append({'label': label, 'viewport': viewport, 'canvas': box})

            fit('startup-1600')
            screenshot('A-empty-startup')
            check(page.locator('#workflowPrimaryAction').is_visible(), 'startup offers a primary action')
            page.locator('#newProjectBtn').click()
            page.locator('#createGameDoc').click()
            page.wait_for_function('state.documentType === "game"')
            screenshot('B-new-gamedoc')

            page.locator('#pngInput').set_input_files(str(artifacts / 'workflow-art.png'))
            page.wait_for_function('state.attachments.length === 1 && state.slots.length === 1')
            screenshot('C-artwork-imported')
            check(page.locator('#sX').is_visible(), 'ART exposes selected artwork transforms')
            page.locator('#sX').fill('24')
            page.locator('#sX').press('Tab')
            page.locator('#toolSelect').click()
            check(page.evaluate('state.slots[0].local.x === 24'), 'ART transform edits existing model')
            page.keyboard.press('Control+z')
            page.wait_for_function('state.slots[0].local.x !== 24')
            page.keyboard.press('Control+Shift+z')
            page.wait_for_function('state.slots[0].local.x === 24')
            check(True, 'Undo/redo shortcuts preserve artwork edits')

            mode('mesh')
            if not page.evaluate('state.slots[0].mesh?.enabled === true'):
                page.locator('#workflowPrimaryAction').click()
            page.wait_for_function('state.slots[0].mesh?.enabled === true')
            check(True, 'MESH creates an enabled mesh before rigging')
            page.locator('#wbMeshGrid33').click()
            check(page.evaluate('state.slots[0].mesh.vertices.length === 16'), 'mesh topology grid editing remains reachable')
            page.keyboard.press('2')
            check(page.evaluate('state.meshEdit.selectionMode === "edge"'), 'mesh edge-selection shortcut preserved')
            page.keyboard.press('1')

            mode('rig')
            page.locator('#toolBone').click()
            box = page.locator('#canvas').bounding_box()
            x = box['x'] + box['width'] / 2
            y = box['y'] + box['height'] / 2
            for start, end in ((80, 0), (0, -70), (-70, -120)):
                page.mouse.move(x, y + start)
                page.mouse.down()
                page.mouse.move(x, y + end, steps=6)
                page.mouse.up()
            page.wait_for_function('state.bones.filter(b => !b.isRoot && !b.objectRoot).length >= 3')
            page.locator('#toolSelect').click()
            screenshot('D-rig-selected-bone')
            check(page.locator('#objectRigTree').is_visible(), 'RIG exposes bone hierarchy')

            setup = page.locator('.workflow-setup-properties')
            setup.locator('summary').click()
            page.get_by_role('button', name='Set Bind Pose', exact=True).click()
            page.wait_for_function('Boolean(state.rig.bindPoseLastSetAt)')
            check(True, 'Rig inspector Set Bind Pose invokes the existing setup command')
            undo_count = page.evaluate('state.undo.length')
            page.get_by_role('button', name='Restore Setup', exact=True).click()
            check(page.evaluate('state.undo.length') == undo_count + 1,
                  'Rig inspector Restore Setup invokes the existing undoable command')
            page.locator('#inspectorTabs').get_by_role('button', name='Rig', exact=True).click()
            mode('art')
            check(page.locator('#iX').is_visible(), 'ART restores Transform when the active Rig inspector tab becomes hidden')
            mode('rig')
            check(page.evaluate('''() => {
              const rows = [...document.querySelectorAll('.tree-row[data-contextual-kind]')];
              return rows.length > 0 && rows.every(
                row => row.querySelectorAll('.contextual-tree-kind').length === 1);
            }'''),
                  'Repeated hierarchy refreshes do not duplicate entity labels')

            slot_name = page.evaluate('state.slots[0].name')
            page.locator('#objectRigTree').get_by_text(slot_name, exact=True).first.click()
            page.wait_for_function('state.selected.type === "slot"')
            if page.locator('#workflowParentBone').count():
                bone_id = page.evaluate('state.bones.find(b => !b.isRoot && !b.objectRoot).id')
                page.locator('#workflowParentBone').select_option(bone_id)
                check(page.evaluate('(id) => state.slots[0].bone === id', bone_id), 'RIG attaches artwork through existing binding command')

            check(page.locator('#meshWorkbenchTabBinding').is_visible(), 'RIG exposes binding for prepared mesh artwork')
            page.locator('#wbFlowAutoObject').click()
            check(page.evaluate('state.slots[0].mesh.vertices.some(v => v.weights.some(w => w.w > 0))'), 'existing auto binding remains reachable')
            page.locator('#meshWorkbenchTabWeights').click()
            page.locator('#wbMeshWeightBone').select_option(bone_id)
            page.locator('#wbWeightStartPaint').click()
            page.wait_for_function('state.meshEdit.weightPaintSession?.active === true')
            before_weights = page.evaluate('JSON.stringify(state.slots[0].mesh.vertices.map(v => v.weights))')
            page.locator('#wbWeightModeSubtract').click()
            brush_point = page.evaluate('''() => {
              const slot = state.slots[0];
              const index = slot.mesh.vertices.findIndex(v => v.weights.some(w => w.bone === state.meshEdit.weightBoneId && w.w > 0.01));
              return w2s(slotMeshWorldVertices(slot)[index]);
            }''')
            canvas_box = page.locator('#canvas').bounding_box()
            page.mouse.move(canvas_box['x'] + brush_point['x'], canvas_box['y'] + brush_point['y'])
            page.mouse.down()
            page.mouse.move(canvas_box['x'] + brush_point['x'] + 3, canvas_box['y'] + brush_point['y'], steps=3)
            page.mouse.up()
            check(page.evaluate('state.meshEdit.weightPaintSession?.dirty === true'), 'weight brush edits within the existing session')
            page.locator('[data-workflow-mode="rig"]').click()
            check(page.locator('.app').get_attribute('data-workflow') == 'mesh', 'active weight session prevents workflow loss')
            page.locator('#wbWeightCancelPaint').click()
            page.wait_for_function('!state.meshEdit.weightPaintSession?.active')
            check(page.evaluate('JSON.stringify(state.slots[0].mesh.vertices.map(v => v.weights))') == before_weights, 'Cancel restores prior weights')
            screenshot('F-mesh-weights')

            click_control('#toggleViewFiltersPanel')
            check(page.locator('.panel-viewfilters').is_visible(), 'View/Pick utility remains reachable')
            page.locator('#showNames').uncheck()
            check(page.evaluate('state.view.names === false'), 'View filter keeps its legacy action')
            page.locator('#pickSlots').uncheck()
            check(page.evaluate('state.pick.slots === false'), 'Pick filter keeps its legacy action')
            page.locator('#pickSlots').check()
            page.keyboard.press('Escape')
            check(not page.locator('.panel-viewfilters').is_visible(), 'Escape closes utility drawer')

            mode('animate')
            page.locator('#objectRigTree').get_by_text('b2', exact=True).first.click()
            page.locator('#keySel').click()
            page.wait_for_function('Object.values(state.anim.boneTracks).some(keys => keys.length > 0)')
            page.locator('#addClip').click()
            check(page.evaluate('state.animations.length >= 2'), 'animation clip creation remains reachable')
            page.locator('#keyAll').click()
            check(page.locator('.animation-timeline').is_visible(), 'ANIMATE exposes full timeline')
            page.locator('#play').click()
            page.wait_for_function('state.playing && state.currentTime > 0')
            page.locator('#stop').click()
            check(page.evaluate('!state.playing'), 'animation transport plays and stops')
            screenshot('E-animation-timeline')

            page.locator('#objectRigTree').get_by_text(slot_name, exact=True).first.click()
            page.locator('#inspectorTabs').get_by_role('button', name='Deform', exact=True).click()
            page.locator('#ffdEditToggle').check()
            page.locator('#ffdKey').click()
            check(page.evaluate('state.anim.deformTracks[state.slots[0].id][0].offsets.length === state.slots[0].mesh.vertices.length'), 'contextual FFD editing and key creation remain reachable')
            page.locator('#ffdEditToggle').uncheck()

            click_control('#toggleViewFiltersPanel')
            click_control('#validateProjectBtnRight')
            check(bool(page.locator('#projectHealth').inner_text().strip()), 'Project diagnostics remain reachable during ANIMATE')
            page.keyboard.press('Escape')

            click_control('#toggleJsonPanel')
            page.locator('#exportRuntime').click()
            runtime = json.loads(page.locator('#runtimeJson').input_value())
            check(runtime['schema'] == 'indie-2d-runtime-v11', 'runtime export schema preserved')
            check(page.evaluate('validateRuntimeDocument(JSON.parse(document.querySelector("#runtimeJson").value)).ok'), 'edited canonical fixture passes runtime validator')
            page.locator('#save').click()
            check(page.evaluate('localStorage.getItem("indie-2d-skeleton-v11-project") !== null'), 'local Project Save remains reachable')
            page.locator('#load').click()
            check(page.evaluate('state.documentType === "game"'), 'local Project Load remains reachable')
            page.keyboard.press('Escape')
            check(page.evaluate('!("workflow" in exportData()) && !("workflowMode" in exportData().editor)'), 'workflow state stays outside persistence contract')

            page.evaluate('''() => {
              const files = new Map();
              function directory(prefix = '') {
                return {
                  getDirectoryHandle: async (name) => directory(prefix + name + '/'),
                  getFileHandle: async (name) => ({
                    createWritable: async () => ({
                      write: async (blob) => files.set(prefix + name, blob),
                      close: async () => {},
                    }),
                    getFile: async () => {
                      if (!files.has(prefix + name)) throw new Error('Missing test file');
                      const blob = files.get(prefix + name);
                      return new File([blob], name, {type: blob.type});
                    },
                  }),
                };
              }
              window.showDirectoryPicker = async () => directory();
              window.workflowTestFolderFiles = () => [...files.keys()];
            }''')
            saved_name = page.evaluate('state.projectName')
            page.locator('#saveProjectFolder').click()
            page.wait_for_function('window.workflowTestFolderFiles().includes("project.json")')
            check(page.evaluate('window.workflowTestFolderFiles().some(name => name.startsWith("assets/"))'), 'folder Save writes image assets through existing path')
            page.evaluate('state.projectName = "Temporary test name"')
            page.locator('#loadProjectFolder').click()
            page.wait_for_function('(name) => state.projectName === name', arg=saved_name)
            check(page.evaluate('state.slots.length === 1 && state.attachments[0].src.startsWith("data:")'), 'folder Open restores project and embedded artwork')

            for width, height in ((1920, 1080), (1600, 900), (1366, 768)):
                page.set_viewport_size({'width': width, 'height': height})
                for name in ('art', 'mesh', 'rig', 'animate'):
                    mode(name)
                    if name in ('art', 'mesh'):
                        page.locator('#drawOrderList').get_by_text(slot_name, exact=True).first.click()
                        page.wait_for_function('state.selected.type === "slot"')
                    page.wait_for_timeout(100)
                    fit(f'{name}-{width}')
                    if width == 1366 and name == 'mesh':
                        screenshot('mesh-1366x768')
                screenshot(f'animation-{width}x{height}')

            toon = browser.new_page(viewport={'width': 1600, 'height': 900})
            toon.on('pageerror', lambda error: report['errors'].append(str(error)))
            toon.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
            toon.wait_for_function('document.querySelector(".app").dataset.workflowReady === "true"')
            toon.locator('#newProjectBtn').click()
            toon.locator('#createToonDoc').click()
            toon.wait_for_function('state.documentType === "toon"')
            check(toon.evaluate('state.toon.canvas.width === 1920'), 'New ToonDoc retains canvas setup')
            toon.locator('#outlinerTabScene').click()
            target = toon.locator('#objectRenderLayerSelect')
            for disclosure in target.locator('xpath=ancestor::details').all():
                if disclosure.get_attribute('open') is None:
                    disclosure.locator(':scope > summary').click()
            target.select_option('fx')
            check(toon.evaluate('state.objects[0].renderLayerId === "fx"'), 'ToonDoc render-layer controls retain their action')
            toon.locator('#cameraViewToggle').click()
            check(toon.evaluate('state.view.cameraView === true'), 'ToonDoc camera preview remains reachable')
            toon.close()

            check(not report['errors'], 'no browser page errors')
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        (artifacts / 'browser-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'checks': len(report['checks']), 'screenshots': len(report['screenshots']), 'errors': report['errors']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--artifacts', type=Path, default=Path('out/scratch/task03'))
    args = parser.parse_args()
    run(args.root.resolve(), args.artifacts.resolve())
