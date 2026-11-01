const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

let buildWorkflowView;
let createWorkflowController;

test.before(async () => {
  ({ buildWorkflowView } = await import('../src/ui/workspace/workflow-view.js'));
  ({ createWorkflowController } = await import(
    '../src/ui/workspace/workflow-controller.js'
  ));
});

function createContext(overrides = {}) {
  return {
    documentType: 'game',
    projectName: 'Demo',
    legacyMode: 'skeleton',
    tool: 'select',
    gizmoMode: 'move',
    selection: { type: 'slot', id: 'slot-1', name: 'Body' },
    objectCount: 1,
    artworkCount: 1,
    boneCount: 2,
    hasMesh: true,
    hasBinding: true,
    canDeform: true,
    meshContext: '',
    meshTab: 'binding',
    isWeightSessionActive: false,
    isTestPoseActive: false,
    playing: false,
    clipCount: 1,
    keyCount: 2,
    ...overrides,
  };
}

function createElement() {
  const attributes = new Map();
  const element = {
    attributes,
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: '',
    title: '',
    getAttribute(name) {
      if (name === 'title') {
        return this.title || null;
      }
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === 'title') {
        this.title = String(value);
      }
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        delete this.dataset[key];
      }
    },
    closest(selector) {
      if (selector.includes('[data-workflow-action]') && this.dataset.workflowAction) {
        return this;
      }
      if (selector.includes('[data-workflow-mode]') && this.dataset.workflowMode) {
        return this;
      }
      if (selector.includes(`#${this.id}`) && this.id) {
        return this;
      }
      if (selector.includes('.panel-viewfilters') && this.className === 'panel-viewfilters') {
        return this;
      }
      if (selector.includes('.project-json-panel') && this.className === 'project-json-panel') {
        return this;
      }
      if (selector.includes('input') && this.tagName === 'INPUT') {
        return this;
      }
      return null;
    },
  };
  return element;
}

function createRoot() {
  const namedElement = (id, title = '') => Object.assign(createElement(), { id, title });
  const elements = new Map([
    ['.workflow-shell', createElement()],
    ['#workflowModeLabel', createElement()],
    ['#workflowModeDescription', createElement()],
    ['#workflowSelectionLabel', createElement()],
    ['#workflowNotice', createElement()],
    ['#workflowGuidance', createElement()],
    ['#workflowGuidanceTitle', createElement()],
    ['#workflowGuidanceText', createElement()],
    ['#workflowPrimaryAction', createElement()],
    ['#workflowSecondaryAction', createElement()],
    ['#workflowToolbar', createElement()],
    ['#toolBone', namedElement('toolBone', 'Create bones (B)')],
    ['#toolSelect', namedElement('toolSelect', 'Select (V)')],
    ['#toolMove', namedElement('toolMove', 'Move (G)')],
    ['#toolRotate', namedElement('toolRotate', 'Rotate (R)')],
    ['#toolScale', namedElement('toolScale', 'Scale (S)')],
    ['#toggleViewFiltersPanel', namedElement('toggleViewFiltersPanel')],
    ['#collapseViewFiltersPanel', namedElement('collapseViewFiltersPanel')],
    ['#toggleJsonPanel', namedElement('toggleJsonPanel')],
    ['#collapseJsonPanel', namedElement('collapseJsonPanel')],
    ['.panel-viewfilters', Object.assign(createElement(), { className: 'panel-viewfilters' })],
    ['.project-json-panel', Object.assign(createElement(), { className: 'project-json-panel' })],
    ['#sceneOutliner', createElement()],
    ['#objectRigTree', createElement()],
    ['#inspector', createElement()],
    ['#inspectorTabs', createElement()],
    ['#meshWorkbench', createElement()],
    ['#clipList', createElement()],
    ['#documentPanel', createElement()],
  ]);
  const modeButtons = ['art', 'mesh', 'rig', 'animate'].map((workflowMode) => {
    const button = createElement();
    button.dataset.workflowMode = workflowMode;
    return button;
  });
  const listeners = new Map();

  const root = {
    dataset: {},
    ownerDocument: { defaultView: {} },
    querySelector(selector) {
      return elements.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-workflow-mode]') {
        return modeButtons;
      }
      if (selector === '[data-workflow-only]') {
        return [];
      }
      if (selector === '[data-workflow-action]') {
        return [...elements.values()].filter((element) => element.dataset.workflowAction);
      }
      return [];
    },
    contains() {
      return true;
    },
    addEventListener(name, listener, capture = false) {
      const registered = listeners.get(name) ?? [];
      registered.push({ listener, capture: capture === true || capture?.capture === true });
      listeners.set(name, registered);
    },
    removeEventListener(name, listener, capture = false) {
      const registered = listeners.get(name) ?? [];
      const useCapture = capture === true || capture?.capture === true;
      listeners.set(name, registered.filter((entry) => (
        entry.listener !== listener || entry.capture !== useCapture
      )));
    },
    dispatchEvent(name, event) {
      const registered = listeners.get(name) ?? [];
      for (const entry of registered) {
        if (entry.capture) {
          entry.listener(event);
          if (event.propagationStopped) {
            break;
          }
        }
      }
      if (!event.propagationStopped) {
        for (const entry of registered) {
          if (!entry.capture) {
            entry.listener(event);
            if (event.propagationStopped) {
              break;
            }
          }
        }
      }
    },
    elements,
    modeButtons,
    listeners,
  };
  root.contains = () => true;
  return root;
}

function createEvent(target, values = {}) {
  return {
    target,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...values,
  };
}

test('controller updates the supplied shell itself, without a nested shell element', () => {
  const root = createRoot();
  root.matches = (selector) => selector === '.workflow-shell';
  root.elements.delete('.workflow-shell');
  const controller = createWorkflowController({
    root,
    readContext: () => createContext(),
    activateMode: () => ({ ok: true }),
    runAction: () => {},
  });
  controller.selectMode('rig');
  assert.equal(root.dataset.workflow, 'rig');
  assert.equal(root.dataset.hasDocument, 'true');
  controller.selectMode('animate');
  assert.equal(root.dataset.workflow, 'animate');
  controller.destroy();
});

function installMutationObserver(root) {
  class MutationObserverStub {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      this.drainCount = 0;
      MutationObserverStub.latest = this;
    }

    observe(target, options) {
      this.observed.push({ target, options });
    }

    takeRecords() {
      this.drainCount += 1;
      return [];
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  root.ownerDocument.defaultView.MutationObserver = MutationObserverStub;
  return MutationObserverStub;
}

test('builds a presentation for all four workflows', () => {
  const context = createContext();
  const expected = {
    art: 'Artwork',
    rig: 'Rig',
    mesh: 'Mesh',
    animate: 'Animation',
  };

  for (const [mode, label] of Object.entries(expected)) {
    const view = buildWorkflowView(context, mode);
    assert.equal(view.mode, mode);
    assert.equal(view.label, label);
    assert.equal(typeof view.description, 'string');
    assert.equal(typeof view.selectionLabel, 'string');
    assert.ok(view.actions);
  }
});

test('primary navigation presents ART, MESH, RIG, ANIMATE in authoring order', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const modes = [...html.matchAll(/data-workflow-mode="(art|mesh|rig|animate)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(modes.slice(0, 4), ['art', 'mesh', 'rig', 'animate']);
});

test('guides an empty startup to New Project and a new document to Import Image', () => {
  const startup = buildWorkflowView(createContext({
    documentType: 'none',
    projectName: '',
    selection: { type: null, id: null, name: '' },
    artworkCount: 0,
    boneCount: 0,
    hasMesh: false,
    hasBinding: false,
    clipCount: 0,
    keyCount: 0,
  }), 'art');
  const emptyDocument = buildWorkflowView(createContext({
    artworkCount: 0,
    boneCount: 0,
    hasMesh: false,
    hasBinding: false,
    clipCount: 0,
    keyCount: 0,
  }), 'art');

  assert.equal(startup.guidance.primary.name, 'new-project');
  assert.equal(startup.guidance.primary.label, 'New Project');
  assert.equal(startup.actions['import-art'].visible, false);
  const toonDocument = buildWorkflowView(createContext({ documentType: 'toon' }), 'art');
  assert.equal(toonDocument.actions['import-art'].enabled, true);
  const startupMesh = buildWorkflowView(createContext({
    documentType: 'none',
    hasMesh: true,
    hasBinding: false,
    canDeform: true,
  }), 'mesh');
  assert.equal(startupMesh.actions['bind-mesh'].visible, false);
  assert.equal(startupMesh.actions['bind-mesh'].enabled, false);
  assert.equal(emptyDocument.guidance.primary.name, 'import-art');
  assert.equal(emptyDocument.guidance.primary.label, 'Import Image');
});

test('guides artwork through optional mesh, then rigging and animation', () => {
  const artworkNeedsMesh = buildWorkflowView(createContext({
    boneCount: 0,
    hasMesh: false,
  }), 'art');
  const artworkPrepared = buildWorkflowView(createContext({ boneCount: 0 }), 'art');
  const rig = buildWorkflowView(createContext({ boneCount: 0 }), 'rig');
  const animation = buildWorkflowView(createContext({
    keyCount: 0,
    selection: { type: 'bone', id: 'bone-1', name: 'Hip' },
  }), 'animate');

  assert.equal(artworkNeedsMesh.guidance.primary.name, 'switch-mesh');
  assert.equal(artworkNeedsMesh.guidance.secondary.name, 'switch-rig');
  assert.equal(artworkPrepared.guidance.primary.name, 'switch-rig');
  assert.equal(rig.guidance.primary.name, 'create-bone');
  assert.match(rig.guidance.text, /Create a bone/);
  assert.equal(animation.guidance.primary.name, 'add-key');
  assert.match(animation.description, /does not require binding or weights/);
  assert.doesNotMatch(animation.guidance.text, /complete|finished/i);
});

test('allows slot-only keys, mesh creation entry, and preview during setup', () => {
  const slotOnly = createContext({
    boneCount: 0,
    clipCount: 0,
    keyCount: 0,
    selection: { type: 'slot', id: 'slot-1', name: 'Body' },
    hasMesh: false,
  });
  const animation = buildWorkflowView(slotOnly, 'animate');
  assert.equal(animation.actions['add-key'].visible, true);
  assert.equal(animation.actions['add-key'].enabled, true);
  assert.equal(animation.guidance.primary.name, 'add-key');

  const artwork = buildWorkflowView({ ...slotOnly, clipCount: 1 }, 'art');
  assert.equal(artwork.actions['switch-animate'].enabled, true);
  assert.equal(artwork.actions['switch-mesh'].enabled, true);
  assert.equal(artwork.actions['preview-play'].visible, true);
  assert.equal(artwork.actions['preview-play'].enabled, true);
});

test('mesh guidance requires an artwork selection and offers Create Mesh when needed', () => {
  const noSelection = buildWorkflowView(createContext({
    selection: { type: null, id: null, name: '' },
    hasMesh: false,
    hasBinding: false,
  }), 'mesh');
  const noArtwork = buildWorkflowView(createContext({
    selection: { type: 'slot', id: 'slot-1', name: 'Body' },
    hasMesh: false,
    hasBinding: false,
  }), 'mesh');

  assert.equal(noSelection.guidance.title, 'Select artwork');
  assert.equal(noSelection.actions['create-mesh'].visible, false);
  assert.equal(noSelection.actions['bind-mesh'].visible, false);
  assert.equal(noArtwork.guidance.primary.name, 'create-mesh');
});

test('prepared mesh continues to Rig and binding guidance belongs to Rig', () => {
  const mesh = buildWorkflowView(createContext({ hasBinding: false }), 'mesh');
  const rig = buildWorkflowView(createContext({ hasBinding: false }), 'rig');

  assert.equal(mesh.guidance.primary.name, 'switch-rig');
  assert.equal(mesh.actions['bind-mesh'].visible, false);
  assert.equal(rig.guidance.primary.name, 'bind-mesh');
  assert.equal(rig.actions['bind-mesh'].visible, true);
  assert.match(rig.guidance.text, /topology is ready/i);
});

test('does not offer mesh deformation actions for an unsupported selection', () => {
  const view = buildWorkflowView(createContext({
    selection: { type: 'bone', id: 'bone-1', name: 'Hip' },
    meshContext: 'deform',
    meshTab: 'weights',
    hasMesh: true,
    hasBinding: false,
  }), 'mesh');

  assert.equal(view.guidance.title, 'Select artwork');
  assert.equal(view.actions['create-mesh'].visible, false);
  assert.equal(view.actions['bind-mesh'].visible, false);
  assert.equal(Object.keys(view.actions).some((name) => /weight|ffd/i.test(name)), false);
});

test('does not mutate the detached context snapshot', () => {
  const context = createContext({
    selection: Object.freeze({ type: 'slot', id: 'slot-1', name: 'Body' }),
  });
  Object.freeze(context);
  const before = JSON.stringify(context);

  buildWorkflowView(context, 'mesh');

  assert.equal(JSON.stringify(context), before);
});

test('a denied mode switch keeps the prior workflow and reports the session denial', () => {
  const root = createRoot();
  let activationCount = 0;
  const controller = createWorkflowController({
    root,
    readContext: () => createContext({ isWeightSessionActive: true }),
    activateMode: () => {
      activationCount += 1;
      return { ok: false, message: 'Finish the weight session first.' };
    },
    runAction: () => undefined,
  });

  const result = controller.selectMode('mesh');

  assert.equal(result.ok, false);
  assert.equal(activationCount, 1);
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'art');
  assert.equal(
    root.elements.get('#workflowNotice').textContent,
    'Finish the weight session first.'
  );
  assert.equal(root.elements.get('#workflowNotice').hidden, false);

  controller.destroy();
});

test('successful mode selection reconciles legacy tool and mesh shortcuts', () => {
  const root = createRoot();
  const context = createContext();
  const controller = createWorkflowController({
    root,
    readContext: () => structuredClone(context),
    activateMode: () => ({ ok: true }),
    runAction: () => undefined,
  });

  context.tool = 'bone';
  controller.refresh();
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'rig');

  context.tool = 'select';
  const artResult = controller.selectMode('art');
  assert.equal(artResult.ok, true);
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'art');

  context.meshContext = 'deform';
  context.legacyMode = 'pose';
  controller.refresh();
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'mesh');

  context.meshContext = '';
  context.legacyMode = 'skeleton';
  controller.selectMode('rig');
  context.legacyMode = 'pose';
  controller.refresh();
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'animate');

  context.legacyMode = 'skeleton';
  controller.selectMode('art');
  context.meshContext = 'vertices';
  controller.refresh();
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'mesh');

  controller.destroy();
});

test('mesh tab transitions select MESH and lingering deform context preserves ART', () => {
  const root = createRoot();
  const context = createContext();
  const controller = createWorkflowController({
    root,
    readContext: () => structuredClone(context),
    activateMode: () => ({ ok: true }),
    runAction: () => undefined,
  });

  controller.selectMode('art');
  context.meshContext = 'deform';
  controller.refresh();
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'art');

  context.meshContext = '';
  context.meshTab = 'weights';
  controller.refresh();
  assert.equal(root.elements.get('.workflow-shell').dataset.workflow, 'mesh');

  controller.destroy();
});

test('dispatches asynchronous toolbar actions through the injected adapter', async () => {
  const root = createRoot();
  const context = createContext({
    documentType: 'none',
    projectName: '',
    artworkCount: 0,
    boneCount: 0,
    selection: { type: null, id: null, name: '' },
    hasMesh: false,
    hasBinding: false,
    clipCount: 0,
    keyCount: 0,
  });
  let resolveAction;
  let actionName = null;
  let refreshCount = 0;
  const controller = createWorkflowController({
    root,
    readContext: () => structuredClone(context),
    activateMode: () => ({ ok: true }),
    runAction(name) {
      actionName = name;
      return new Promise((resolve) => {
        resolveAction = resolve;
      });
    },
    onRefresh: () => {
      refreshCount += 1;
    },
  });

  const primary = root.elements.get('#workflowPrimaryAction');
  root.dispatchEvent('click', createEvent(primary));
  assert.equal(actionName, 'new-project');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshCount, 2);
  assert.equal(root.dataset.hasDocument, 'false');

  context.documentType = 'game';
  context.projectName = 'Created';
  resolveAction({ ok: true });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(root.dataset.hasDocument, 'true');
  assert.equal(root.elements.get('#workflowPrimaryAction').dataset.workflowAction, 'import-art');
  controller.destroy();
});

test('utility drawers close on Escape and preserve tool shortcuts and titles', () => {
  const root = createRoot();
  const context = createContext({
    documentType: 'none',
    selection: { type: null, id: null, name: '' },
    artworkCount: 0,
    hasMesh: false,
    hasBinding: false,
  });
  const controller = createWorkflowController({
    root,
    readContext: () => structuredClone(context),
    activateMode: () => ({ ok: true }),
    runAction: () => undefined,
  });

  const selectTool = root.elements.get('#toolSelect');
  assert.equal(root.dataset.hasDocument, 'false');
  assert.equal(selectTool.disabled, true);
  assert.match(selectTool.title, /Select \(V\)/);
  assert.equal(root.elements.get('#toolBone').hidden, true);

  context.documentType = 'game';
  controller.refresh();
  assert.equal(selectTool.disabled, false);
  assert.equal(selectTool.title, 'Select (V)');
  assert.equal(root.dataset.hasDocument, 'true');

  const toggle = root.elements.get('#toggleViewFiltersPanel');
  const toggleEvent = createEvent(toggle);
  root.dispatchEvent('click', toggleEvent);
  assert.equal(root.dataset.utility, 'view');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggleEvent.propagationStopped, true);

  const input = Object.assign(createElement(), { tagName: 'INPUT' });
  const inputEscape = createEvent(input, { key: 'Escape' });
  root.dispatchEvent('keydown', inputEscape);
  assert.equal(root.dataset.utility, 'none');
  assert.equal(inputEscape.propagationStopped, false);
  assert.equal(inputEscape.defaultPrevented, false);

  root.dispatchEvent('click', createEvent(toggle));
  let legacyEscapeCount = 0;
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      legacyEscapeCount += 1;
    }
  });

  const escapeEvent = createEvent(toggle, { key: 'Escape' });
  root.dispatchEvent('keydown', escapeEvent);
  assert.equal(root.dataset.utility, 'none');
  assert.equal(escapeEvent.defaultPrevented, false);
  assert.equal(escapeEvent.propagationStopped, false);
  assert.equal(legacyEscapeCount, 1);

  let expectedLegacyEscapeCount = 1;
  for (const activeContext of [
    { meshContext: 'vertices' },
    { isWeightSessionActive: true },
    { isTestPoseActive: true },
  ]) {
    Object.assign(context, activeContext);
    root.dispatchEvent('click', createEvent(toggle));
    const editingEscape = createEvent(toggle, { key: 'Escape' });
    root.dispatchEvent('keydown', editingEscape);
    assert.equal(root.dataset.utility, 'none');
    assert.equal(editingEscape.defaultPrevented, false);
    assert.equal(editingEscape.propagationStopped, false);
    expectedLegacyEscapeCount += 1;
    assert.equal(legacyEscapeCount, expectedLegacyEscapeCount);
    Object.assign(context, {
      meshContext: '',
      isWeightSessionActive: false,
      isTestPoseActive: false,
    });
  }

  const jsonToggle = root.elements.get('#toggleJsonPanel');
  const jsonCollapse = root.elements.get('#collapseJsonPanel');
  root.dispatchEvent('click', createEvent(jsonCollapse));
  assert.equal(root.dataset.utility, 'none');

  root.dispatchEvent('click', createEvent(jsonToggle));
  assert.equal(root.dataset.utility, 'data');
  assert.equal(jsonToggle.getAttribute('aria-expanded'), 'true');
  root.dispatchEvent('click', createEvent(jsonCollapse));
  assert.equal(root.dataset.utility, 'none');
  assert.equal(jsonToggle.getAttribute('aria-expanded'), 'false');

  root.dispatchEvent('click', createEvent(toggle));
  root.dispatchEvent('pointerdown', createEvent(createElement()));
  assert.equal(root.dataset.utility, 'none');

  controller.destroy();
});

test('coalesces delegated and observed changes and disconnects on destroy', async () => {
  const root = createRoot();
  const Observer = installMutationObserver(root);
  let readCount = 0;
  let refreshCount = 0;
  const controller = createWorkflowController({
    root,
    readContext: () => {
      readCount += 1;
      return createContext();
    },
    activateMode: () => ({ ok: true }),
    runAction: () => undefined,
    onRefresh: () => {
      refreshCount += 1;
    },
  });

  assert.equal(Observer.latest.observed.length, 7);
  root.dispatchEvent('input', createEvent(root));
  Observer.latest.callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(readCount, 2);
  assert.equal(refreshCount, 2);

  root.dispatchEvent('pointerup', createEvent(root));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(readCount, 3);
  assert.equal(refreshCount, 3);
  assert.equal(Observer.latest.drainCount, 3);

  controller.destroy();
  assert.equal(Observer.latest.disconnected, true);
});

test('guidance action tooltip clears when its action becomes available', () => {
  const root = createRoot();
  const context = createContext({
    keyCount: 0,
    selection: { type: null, id: null, name: '' },
  });
  const controller = createWorkflowController({
    root,
    readContext: () => structuredClone(context),
    activateMode: () => ({ ok: true }),
    runAction: () => undefined,
  });
  controller.selectMode('animate');

  const addKey = root.elements.get('#workflowPrimaryAction');
  assert.equal(addKey.disabled, true);
  assert.equal(addKey.title, 'Select artwork or a bone before adding a key.');

  context.selection = { type: 'slot', id: 'slot-1', name: 'Body' };
  controller.refresh();
  assert.equal(addKey.disabled, false);
  assert.equal(addKey.title, '');

  context.selection = { type: 'bone', id: 'bone-1', name: 'Hip' };
  controller.refresh();
  assert.equal(addKey.disabled, false);
  assert.equal(addKey.title, '');

  controller.destroy();
});
