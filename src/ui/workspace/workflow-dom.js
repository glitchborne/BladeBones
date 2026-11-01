import { updateWorkflowEmptyState } from '../empty-states/workflow-empty-state.js';
import { hasWorkflowDocument } from './workflow-view.js';

function setText(element, value) {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function setAttribute(element, name, value) {
  if (element && element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function setHidden(element, hidden) {
  if (element && element.hidden !== hidden) {
    element.hidden = hidden;
  }
}

function setDisabled(element, disabled) {
  if (element && element.disabled !== disabled) {
    element.disabled = disabled;
  }
}

function setData(element, name, value) {
  if (element?.dataset) {
    if (element.dataset[name] !== value) {
      element.dataset[name] = value;
    }
    return;
  }

  const attributeName = `data-${name.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`
  )}`;
  setAttribute(element, attributeName, value);
}

function setNotice(root, message) {
  const notice = root.querySelector('#workflowNotice');
  setText(notice, message);
  setHidden(notice, !message);
  if (notice) {
    setAttribute(notice, 'role', 'status');
    setAttribute(notice, 'aria-live', 'polite');
  }
}

function setControlAvailability(element, enabled, explanation, originalTitles) {
  if (!element) {
    return;
  }

  if (!originalTitles.has(element)) {
    originalTitles.set(element, element.getAttribute('title') ?? '');
  }
  const originalTitle = originalTitles.get(element);
  setDisabled(element, !enabled);
  const title = enabled
    ? originalTitle
    : [explanation, originalTitle].filter(Boolean).join(' ');
  setAttribute(element, 'title', title);
}

/** Update the utility drawer's local presentation state and expanded controls. */
export function updateWorkflowUtilityControls(root, utility) {
  setData(root, 'utility', utility);
  const controls = {
    toggleViewFiltersPanel: 'view',
    collapseViewFiltersPanel: 'view',
    toggleJsonPanel: 'data',
    collapseJsonPanel: 'data',
  };

  for (const [id, panel] of Object.entries(controls)) {
    setAttribute(root.querySelector(`#${id}`), 'aria-expanded', String(utility === panel));
  }
}

/** Update workflow-owned DOM, then let Main refresh its contextual legacy panels. */
export function renderWorkflowDom({
  root,
  context,
  mode,
  notice,
  utility,
  view,
  originalTitles,
  onRefresh,
  observer,
}) {
  const shell = root.matches?.('.workflow-shell') ? root : root.querySelector('.workflow-shell');

  setData(shell, 'workflow', mode);
  setData(root, 'hasDocument', String(hasWorkflowDocument(context)));
  setData(root, 'hasArtwork', String(Number(context?.artworkCount) > 0));
  setData(root, 'hasMesh', String(Boolean(context?.hasMesh)));
  setText(root.querySelector('#workflowModeLabel'), view.label);
  setText(root.querySelector('#workflowModeDescription'), view.description);
  setText(root.querySelector('#workflowSelectionLabel'), view.selectionLabel);
  setNotice(root, notice);
  updateWorkflowEmptyState(root, view.guidance, view.actions);

  for (const button of root.querySelectorAll('[data-workflow-mode]')) {
    const active = button.dataset.workflowMode === mode;
    setAttribute(button, 'aria-pressed', String(active));
  }

  for (const element of root.querySelectorAll('[data-workflow-only]')) {
    const allowedModes = String(element.dataset.workflowOnly ?? '')
      .split(/[\s,]+/)
      .filter(Boolean);
    setHidden(element, !allowedModes.includes(mode));
  }

  const hasDocument = hasWorkflowDocument(context);
  const boneTool = root.querySelector('#toolBone');
  setHidden(boneTool, mode !== 'rig');
  setControlAvailability(
    boneTool,
    hasDocument,
    'Create or open a project before creating bones.',
    originalTitles
  );
  setControlAvailability(
    root.querySelector('#toolSelect'),
    hasDocument,
    'Create or open a project before selecting canvas items.',
    originalTitles
  );
  setControlAvailability(
    root.querySelector('#toolMove'),
    hasDocument && Boolean(context?.selection?.id),
    'Select a document item before moving it.',
    originalTitles
  );
  setControlAvailability(
    root.querySelector('#toolRotate'),
    hasDocument && Boolean(context?.selection?.id),
    'Select a document item before rotating it.',
    originalTitles
  );
  setControlAvailability(
    root.querySelector('#toolScale'),
    hasDocument && Boolean(context?.selection?.id),
    'Select a document item before scaling it.',
    originalTitles
  );

  onRefresh?.(context, mode);

  for (const button of root.querySelectorAll('[data-workflow-action]')) {
    const availability = view.actions[button.dataset.workflowAction];
    setHidden(button, !availability?.visible);
    setControlAvailability(
      button,
      Boolean(availability?.enabled),
      availability?.title || 'This action is not available in the current context.',
      originalTitles
    );
  }

  updateWorkflowUtilityControls(root, utility);
  observer?.takeRecords();
}
