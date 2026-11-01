import { createContextualHierarchy } from '../hierarchy/contextual-hierarchy.js';
import { createInspectorAdvancedPresentation } from './inspector-advanced.js';
import { createMeshWorkbenchPresentation } from './mesh-workbench-presentation.js';

const SELECTION_LABELS = {
  attachment: 'Attachment',
  bone: 'Bone',
  camera: 'Camera',
  marker: 'Marker',
  object: 'Object',
  slot: 'Slot',
};

/**
 * Adds contextual presentation around legacy inspector DOM without owning its controls.
 * The supplied root is the workflow shell (or a containing editor root), and actions are
 * dispatched by name to the application composition layer.
 *
 * @param {{ root: Element, runAction: (name: string) => void }} options
 * @returns {{ refresh: (context: object, mode: string) => void, destroy: () => void }}
 */
export function createContextualPanels({ root, runAction }) {
  if (!root?.querySelector || !root.ownerDocument) {
    throw new TypeError('createContextualPanels requires a DOM root element.');
  }

  const document = root.ownerDocument;
  const advancedPresentation = createInspectorAdvancedPresentation({ root });
  const hierarchyPresentation = createContextualHierarchy({ root });
  const meshWorkbenchPresentation = createMeshWorkbenchPresentation({ root });
  let isRefreshing = false;

  function findElement(selector) {
    if (root.matches?.(selector)) {
      return root;
    }

    return root.querySelector(selector);
  }

  function getOrCreateSelectionHeading(inspector) {
    let heading = inspector.querySelector(':scope > .contextual-selection-heading');
    if (heading) {
      return heading;
    }

    heading = document.createElement('section');
    heading.className = 'contextual-selection-heading';
    heading.setAttribute('aria-label', 'Current selection');
    heading.setAttribute('aria-live', 'polite');

    const copy = document.createElement('div');
    copy.className = 'contextual-selection-copy';

    const modeLabel = document.createElement('div');
    modeLabel.className = 'contextual-mode-label';
    modeLabel.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h4');
    title.className = 'contextual-selection-title';

    const type = document.createElement('span');
    type.className = 'contextual-selection-type';

    const name = document.createElement('span');
    name.className = 'contextual-selection-name';
    title.append(type, name);

    const summary = document.createElement('p');
    summary.className = 'contextual-selection-summary';

    copy.append(modeLabel, title, summary);

    const actions = document.createElement('div');
    actions.className = 'contextual-selection-actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Workflow actions');

    heading.append(copy, actions);
    inspector.insertBefore(heading, inspector.firstChild);
    return heading;
  }

  function selectionSummary(context, mode) {
    if (context.isWeightSessionActive) {
      return 'Weight session: Apply or Cancel to finish.';
    }
    if (context.isTestPoseActive) {
      return 'Temporary test pose; setup is unchanged.';
    }
    if (!context.selection?.id) {
      return 'Choose an item in Hierarchy.';
    }
    if (context.selection.type === 'slot') {
      return context.hasMesh
        ? (context.hasBinding ? 'Mesh artwork / bound' : 'Mesh artwork / unbound')
        : 'Artwork / rigid transform';
    }
    return mode === 'animate' ? 'Animation properties' : 'Setup properties';
  }

  function actionsFor(context, mode) {
    if (!['game', 'toon'].includes(context.documentType)) {
      return [['new-project', 'New project']];
    }
    if (context.isWeightSessionActive || context.isTestPoseActive) {
      return [];
    }
    if (mode === 'art' && !context.artworkCount) {
      return [['import-art', 'Import image']];
    }
    if ((mode === 'art' || mode === 'rig') && !context.boneCount) {
      return [['create-bone', 'Create bone']];
    }
    if (mode === 'mesh' && context.selection?.type === 'slot') {
      if (!context.hasMesh) {
        return [['create-mesh', 'Create mesh']];
      }
      if (!context.hasBinding) {
        return [['bind-mesh', 'Open Binding']];
      }
    }
    if (mode === 'animate' && context.selection?.id && !context.keyCount) {
      return [['add-key', 'Add key']];
    }
    return [];
  }

  function renderActionButtons(container, actions) {
    const existing = Array.from(container.children);
    const sameActions = existing.length === actions.length && existing.every((button, index) => {
      return button.dataset.actionName === actions[index][0];
    });

    if (sameActions) {
      return;
    }

    const buttons = actions.map(([name, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'contextual-action-button';
      button.dataset.actionName = name;
      button.dataset.workflowAction = name;
      button.textContent = label;
      button.addEventListener('click', () => runAction?.(name));
      return button;
    });

    container.replaceChildren(...buttons);
  }

  function updateSelectionHeading(inspector, context, mode) {
    const heading = getOrCreateSelectionHeading(inspector);
    const selection = context.selection || {};
    const selectedName = String(selection.name || '').trim();
    const typeLabel = SELECTION_LABELS[selection.type] || '';
    const nameText = selectedName || (selection.id ? String(selection.id) : 'No selection');
    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
    const typeNode = heading.querySelector('.contextual-selection-type');
    const nameNode = heading.querySelector('.contextual-selection-name');
    const modeNode = heading.querySelector('.contextual-mode-label');
    const summaryNode = heading.querySelector('.contextual-selection-summary');

    if (typeNode.textContent !== typeLabel) {
      typeNode.textContent = typeLabel;
    }

    if (nameNode.textContent !== nameText) {
      nameNode.textContent = nameText;
    }

    if (modeNode.textContent !== modeLabel) {
      modeNode.textContent = modeLabel;
    }

    const summary = selectionSummary(context, mode);
    if (summaryNode.textContent !== summary) {
      summaryNode.textContent = summary;
    }

    if (heading.dataset.mode !== mode) {
      heading.dataset.mode = mode;
    }

    const actionContainer = heading.querySelector('.contextual-selection-actions');
    renderActionButtons(actionContainer, actionsFor(context, mode));
  }

  function setHidden(element, hidden) {
    if (element && element.hidden !== hidden) {
      element.hidden = hidden;
    }
  }

  function renderGateActions(container, actionNames) {
    if (!container) {
      return;
    }

    const current = Array.from(container.children);
    const sameActions = current.length === actionNames.length && current.every((button, index) => {
      return button.dataset.actionName === actionNames[index][0];
    });
    if (sameActions) {
      return;
    }

    const buttons = actionNames.map(([name, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'contextual-action-button';
      button.dataset.actionName = name;
      button.dataset.workflowAction = name;
      button.textContent = label;
      button.addEventListener('click', () => runAction?.(name));
      return button;
    });
    container.replaceChildren(...buttons);
  }

  function gateUnavailableDeform(inspector, context, activeLabel) {
    const previousContent = inspector.querySelector(':scope > .contextual-deform-content');
    const gate = inspector.querySelector(':scope > .contextual-deform-gate');
    const shouldGate = activeLabel === 'deform' && !(
      context.selection?.type === 'slot' && context.canDeform === true
    );

    if (!shouldGate) {
      setHidden(previousContent, false);
      setHidden(gate, true);
      return;
    }

    let content = previousContent;
    if (!content) {
      content = document.createElement('div');
      content.className = 'contextual-deform-content';
      const excluded = new Set([
        inspector.querySelector(':scope > .contextual-selection-heading'),
        inspector.querySelector(':scope > .contextual-deform-gate'),
      ]);
      for (const child of Array.from(inspector.childNodes)) {
        if (!excluded.has(child)) {
          content.appendChild(child);
        }
      }
      inspector.appendChild(content);
    }

    let guidance = gate;
    if (!guidance) {
      guidance = document.createElement('div');
      guidance.className = 'contextual-deform-gate';
      guidance.setAttribute('role', 'status');
      guidance.setAttribute('aria-live', 'polite');

      const message = document.createElement('p');
      message.className = 'contextual-guidance-message';
      guidance.appendChild(message);

      const actions = document.createElement('div');
      actions.className = 'contextual-guidance-actions';
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Available workflow actions');
      guidance.appendChild(actions);
      inspector.appendChild(guidance);
    }

    const message = guidance.querySelector('.contextual-guidance-message');
    const actionContainer = guidance.querySelector('.contextual-guidance-actions');
    const isSlot = context.selection?.type === 'slot';
    const messageText = isSlot
      ? 'This slot cannot use the current deformation controls.'
      : 'Select an artwork slot to continue.';
    if (message.textContent !== messageText) {
      message.textContent = messageText;
    }

    const actionName = context.hasMesh ? 'switch-mesh' : 'create-mesh';
    const actionLabel = context.hasMesh ? 'Mesh workflow' : 'Create mesh';
    const actions = isSlot ? [[actionName, actionLabel]] : [];
    renderGateActions(actionContainer, actions);
    setHidden(content, true);
    setHidden(guidance, false);
  }

  function refresh(context, mode) {
    if (isRefreshing) {
      return;
    }

    const currentMode = ['art', 'rig', 'mesh', 'animate'].includes(mode) ? mode : 'art';
    const selection = context || {};

    isRefreshing = true;
    try {
      const inspector = findElement('#inspector');
      if (inspector) {
        const activeLabel = advancedPresentation.refresh(inspector, selection, currentMode);
        updateSelectionHeading(inspector, selection, currentMode);
        gateUnavailableDeform(inspector, selection, activeLabel);
      }

      hierarchyPresentation.refresh(selection, currentMode);
      meshWorkbenchPresentation.refresh(selection, currentMode);
    } finally {
      isRefreshing = false;
    }
  }

  function destroy() {
    advancedPresentation.destroy();
    hierarchyPresentation.destroy();
    meshWorkbenchPresentation.destroy();

    const inspector = findElement('#inspector');
    if (inspector) {
      inspector.querySelectorAll('.contextual-selection-heading').forEach(
        element => element.remove()
      );
      inspector.querySelectorAll('.contextual-deform-gate').forEach(element => element.remove());
      inspector.querySelectorAll('.contextual-deform-content').forEach(content => {
        while (content.firstChild) {
          content.parentElement.insertBefore(content.firstChild, content);
        }
        content.remove();
      });
    }
  }

  return { refresh, destroy };
}
