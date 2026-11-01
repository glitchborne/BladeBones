'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const adapterModule = import('../src/editor/legacy/workflow-adapter.js');

function fixture() {
  return {
    documentType: 'game', projectName: 'Character', mode: 'skeleton',
    tool: 'select', gizmoMode: 'move', projectRootId: 'root',
    selected: { type: 'slot', id: 's1' },
    objects: [{ id: 'obj1', root: 'b1' }],
    bones: [
      { id: 'root', isRoot: true },
      { id: 'b1', objectRoot: true, objectId: 'obj1' },
      { id: 'b2', name: 'Arm', objectId: 'obj1' },
      { id: 'b3', name: 'Other rig', objectId: 'obj2' },
    ],
    slots: [{ id: 's1', name: 'Sleeve', objectId: 'obj1', bone: null }],
    attachments: [{ id: 'a1' }], markers: [], animations: [{}],
    anim: { boneTracks: { b2: [{ t: 0 }, { t: 1 }] }, cameraTracks: {} },
    meshEdit: { enabled: false, tool: 'weights', workbenchTab: 'binding' },
    rig: { testPose: { active: false } }, playing: false, undo: [],
  };
}

test('workflow snapshot never initializes mesh, setup, curves or source arrays', async () => {
  const { readWorkflowContext } = await adapterModule;
  const state = fixture();
  const before = structuredClone(state);
  const context = readWorkflowContext(state);
  assert.deepEqual(state, before);
  assert.equal(context.hasMesh, false);
  assert.equal(context.keyCount, 2);
});

test('workflow counts omit project/object roots and ignore inactive mesh editing', async () => {
  const { readWorkflowContext } = await adapterModule;
  const context = readWorkflowContext(fixture());
  assert.equal(context.boneCount, 2);
  assert.equal(context.meshContext, null);
});

test('Rig parent choices are detached and restricted to artwork object', async () => {
  const { readWorkflowContext } = await adapterModule;
  const state = fixture();
  const context = readWorkflowContext(state);
  assert.deepEqual(context.boneOptions.map((bone) => bone.id), ['b1', 'b2']);
  context.boneOptions[1].name = 'Changed presentation';
  assert.equal(state.bones[2].name, 'Arm');
});

test('FFD readiness requires an enabled mesh on the selected slot', async () => {
  const { readWorkflowContext } = await adapterModule;
  const state = fixture();
  state.slots[0].mesh = { enabled: false, vertices: [{ x: 0, y: 0, weights: [] }] };
  assert.equal(readWorkflowContext(state).canDeform, false);
  state.slots[0].mesh.enabled = true;
  assert.equal(readWorkflowContext(state).canDeform, true);
  state.selected = { type: 'bone', id: 'b2' };
  assert.equal(readWorkflowContext(state).canDeform, false);
});

test('weight session blocks workflow change without calling legacy setters', async () => {
  const { createLegacyWorkflowAdapter } = await adapterModule;
  const state = fixture();
  state.meshEdit.weightPaintSession = { active: true };
  const before = structuredClone(state);
  const adapter = createLegacyWorkflowAdapter({
    state, root: { dataset: { workflow: 'mesh' } }, commands: {}, views: {},
  });
  assert.equal(adapter.activateMode('rig').ok, false);
  assert.equal(adapter.activateMode('mesh').ok, true);
  assert.deepEqual(state, before);
});

test('test pose blocks workflow change without altering source or history', async () => {
  const { createLegacyWorkflowAdapter } = await adapterModule;
  const state = fixture();
  state.rig.testPose.active = true;
  const before = structuredClone(state);
  const adapter = createLegacyWorkflowAdapter({
    state, root: { dataset: { workflow: 'mesh' } }, commands: {}, views: {},
  });
  assert.equal(adapter.activateMode('art').ok, false);
  assert.deepEqual(state, before);
});

test('Rig parent selection rejects an unrelated bone before any command runs', async () => {
  const { createLegacyWorkflowAdapter } = await adapterModule;
  const state = fixture();
  const before = structuredClone(state);
  const adapter = createLegacyWorkflowAdapter({
    state, root: { dataset: { workflow: 'rig' } }, commands: {}, views: {},
  });
  assert.equal(adapter.bindSelectedArtwork('b3').ok, false);
  assert.deepEqual(state, before);
});

test('Rig parent selection rejects animation/loading contexts without losing undo', async () => {
  const { createLegacyWorkflowAdapter } = await adapterModule;
  const state = fixture();
  state.undo.push('existing');
  const adapter = createLegacyWorkflowAdapter({
    state, root: { dataset: { workflow: 'rig' } }, commands: {}, views: {},
  });
  state.mode = 'pose';
  assert.equal(adapter.bindSelectedArtwork('b2').ok, false);
  state.mode = 'skeleton';
  state.loading = true;
  assert.equal(adapter.bindSelectedArtwork('b2').ok, false);
  assert.deepEqual(state.undo, ['existing']);
});

test('bone tool starts from the artwork object root without creating or modifying bones', async () => {
  const { createLegacyWorkflowAdapter } = await adapterModule;
  const state = fixture();
  const before = structuredClone(state.bones);
  const adapter = createLegacyWorkflowAdapter({
    state,
    root: { dataset: { workflow: 'rig' } },
    commands: { select: (type, id) => { state.selected = { type, id }; } },
    views: {},
  });
  adapter.prepareBoneCreationContext();
  assert.deepEqual(state.selected, { type: 'bone', id: 'b1' });
  assert.deepEqual(state.bones, before);
});

test('Mesh opens topology first and Rig opens binding for a prepared mesh', async () => {
  const { createLegacyWorkflowAdapter } = await adapterModule;
  const state = fixture();
  state.slots[0].mesh = {
    enabled: true,
    vertices: [
      { x: 0, y: 0, weights: [] },
      { x: 1, y: 0, weights: [] },
      { x: 0, y: 1, weights: [] },
    ],
    triangles: [0, 1, 2],
  };
  const openedTabs = [];
  const commands = {
    setMode: () => {},
    setTool: (tool) => { state.tool = tool; },
    setMeshWorkbenchTab: (tab) => { openedTabs.push(tab); state.meshEdit.workbenchTab = tab; },
    stopPlayback: () => {},
    restoreBindPose: () => {},
  };
  const views = {
    setOutlinerTab: () => {},
    renderAll: () => {},
  };
  const adapter = createLegacyWorkflowAdapter({
    state,
    root: { dataset: { workflow: 'art' } },
    commands,
    views,
  });

  assert.equal(adapter.activateMode('mesh').ok, true);
  assert.equal(openedTabs.at(-1), 'mesh');
  assert.equal(adapter.activateMode('rig').ok, true);
  assert.equal(openedTabs.at(-1), 'binding');
});
