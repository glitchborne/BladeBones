import { renderWorkflowDom, updateWorkflowUtilityControls } from './workflow-dom.js';
import { buildWorkflowView } from './workflow-view.js';

const WORKFLOW_MODES = new Set(['art', 'rig', 'mesh', 'animate']);
const OBSERVED_ROOT_IDS = [
  'sceneOutliner',
  'objectRigTree',
  'inspector',
  'inspectorTabs',
  'meshWorkbench',
  'clipList',
  'documentPanel',
];
const UTILITY_CONTROLS = Object.freeze({
  toggleViewFiltersPanel: 'view',
  collapseViewFiltersPanel: 'view',
  toggleJsonPanel: 'data',
  collapseJsonPanel: 'data',
});

function isPoseMode(context) {
  return ['pose', 'animate', 'animation'].includes(
    String(context?.legacyMode ?? '').toLowerCase()
  );
}

function meshTool(context) {
  const meshContext = context?.meshContext;
  return typeof meshContext === 'string'
    ? meshContext.toLowerCase()
    : String(meshContext?.tool ?? meshContext?.mode ?? '').toLowerCase();
}

function isMeshEditingContext(context) {
  const meshTab = String(context?.meshTab ?? '').toLowerCase();
  return ['vertices', 'vertex', 'weights', 'weight'].includes(meshTool(context)) ||
    ['mesh', 'weights', 'weight'].includes(meshTab);
}

/** Bind a workflow shell to explicit legacy adapter services. */
export function createWorkflowController({
  root,
  readContext,
  activateMode,
  runAction,
  onRefresh,
}) {
  if (!root || typeof root.querySelector !== 'function') {
    throw new TypeError('Workflow root must be an .app HTMLElement.');
  }
  if (typeof readContext !== 'function' || typeof activateMode !== 'function') {
    throw new TypeError('Workflow context and mode services are required.');
  }
  if (typeof runAction !== 'function') {
    throw new TypeError('Workflow action service is required.');
  }

  let mode = 'art';
  let utility = 'none';
  let notice = '';
  let lastContext = null;
  let lastView = null;
  let observer = null;
  let refreshQueued = false;
  let destroyed = false;
  const originalTitles = new WeakMap();

  function render(context) {
    const view = buildWorkflowView(context, mode);
    lastView = view;
    renderWorkflowDom({
      root,
      context,
      mode,
      notice,
      utility,
      view,
      originalTitles,
      onRefresh,
      observer,
    });
    return view;
  }

  function setUtility(nextUtility) {
    utility = nextUtility;
    updateWorkflowUtilityControls(root, utility);
  }

  function reconcileMode(context) {
    if (context?.tool === 'bone') {
      return 'rig';
    }

    const enteredMeshEditingContext = isMeshEditingContext(context) &&
      (!lastContext || !isMeshEditingContext(lastContext));
    if (enteredMeshEditingContext) {
      return 'mesh';
    }

    const enteredPoseMode = isPoseMode(context) &&
      (!lastContext || !isPoseMode(lastContext));
    if (enteredPoseMode) {
      return meshTool(context) === 'deform' ? 'mesh' : 'animate';
    }

    return mode;
  }

  function refresh() {
    if (destroyed) {
      return null;
    }

    const context = readContext();
    const nextMode = reconcileMode(context);
    if (nextMode !== mode) {
      mode = nextMode;
      notice = '';
    }
    lastContext = context;
    return render(context);
  }

  function scheduleRefresh() {
    if (destroyed || refreshQueued) {
      return;
    }

    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refresh();
    });
  }

  function selectMode(nextMode) {
    if (!WORKFLOW_MODES.has(nextMode)) {
      return { ok: false, message: 'Unknown workflow mode.' };
    }

    const result = activateMode(nextMode);
    if (!result?.ok) {
      notice = result?.message || 'Finish the active editing session before changing modes.';
      const context = lastContext ?? readContext();
      lastContext = context;
      render(context);
      return { ok: false, message: notice };
    }

    mode = nextMode;
    notice = '';
    return { ok: true, mode, view: refresh() };
  }

  async function dispatchAction(name) {
    const availability = lastView?.actions[name];
    if (!availability?.visible || !availability.enabled) {
      return;
    }

    try {
      const result = await runAction(name);
      notice = result?.ok === false ? result.message || 'That action could not be completed.' : '';
    } catch (error) {
      notice = error instanceof Error ? error.message : 'That action could not be completed.';
    }
    scheduleRefresh();
  }

  function handleCaptureClick(event) {
    const target = event.target?.closest?.(
      '#toggleViewFiltersPanel, #collapseViewFiltersPanel, #toggleJsonPanel, ' +
      '#collapseJsonPanel'
    );
    if (target && root.contains(target)) {
      event.preventDefault();
      event.stopPropagation();
      const requested = UTILITY_CONTROLS[target.id];
      if (target.id.startsWith('collapse')) {
        setUtility('none');
      } else {
        setUtility(utility === requested ? 'none' : requested);
      }
      scheduleRefresh();
      return;
    }

    const actionButton = event.target?.closest?.('[data-workflow-action]');
    if (!actionButton || !root.contains(actionButton)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    scheduleRefresh();
    void dispatchAction(actionButton.dataset.workflowAction);
  }

  function handleClick(event) {
    const button = event.target?.closest?.('[data-workflow-mode]');
    if (button && root.contains(button)) {
      const requested = button.dataset.workflowMode;
      if (WORKFLOW_MODES.has(requested)) {
        event.preventDefault();
        selectMode(requested);
      }
    }

    scheduleRefresh();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && utility !== 'none') {
      const opener = root.querySelector(utility === 'view'
        ? '#toggleViewFiltersPanel' : '#toggleJsonPanel');
      setUtility('none');
      const menu = opener?.closest?.('details');
      const focusTarget = menu && !menu.open ? menu.querySelector('summary') : opener;
      focusTarget?.focus?.();
    }

    scheduleRefresh();
  }

  function handlePointerDown(event) {
    if (utility === 'none') {
      return;
    }

    const inActivePanel = utility === 'view'
      ? event.target?.closest?.('.panel-viewfilters')
      : event.target?.closest?.('.project-json-panel');
    const onUtilityControl = event.target?.closest?.(
      '#toggleViewFiltersPanel, #collapseViewFiltersPanel, #toggleJsonPanel, ' +
      '#collapseJsonPanel'
    );
    if (!inActivePanel && !onUtilityControl) {
      setUtility('none');
    }
  }

  function handleObservedMutations() {
    scheduleRefresh();
  }

  root.addEventListener('click', handleCaptureClick, true);
  root.addEventListener('click', handleClick);
  root.addEventListener('change', scheduleRefresh);
  root.addEventListener('input', scheduleRefresh);
  root.addEventListener('keydown', handleKeydown);
  root.addEventListener('pointerdown', handlePointerDown, true);
  root.addEventListener('pointerup', scheduleRefresh);

  const MutationObserverClass = root.ownerDocument?.defaultView?.MutationObserver;
  if (MutationObserverClass) {
    observer = new MutationObserverClass(handleObservedMutations);
    for (const id of OBSERVED_ROOT_IDS) {
      const observedRoot = root.querySelector(`#${id}`);
      if (observedRoot) {
        observer.observe(observedRoot, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        });
      }
    }
  }

  refresh();

  return {
    refresh,
    selectMode,
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      observer?.disconnect();
      root.removeEventListener('click', handleCaptureClick, true);
      root.removeEventListener('click', handleClick);
      root.removeEventListener('change', scheduleRefresh);
      root.removeEventListener('input', scheduleRefresh);
      root.removeEventListener('keydown', handleKeydown);
      root.removeEventListener('pointerdown', handlePointerDown, true);
      root.removeEventListener('pointerup', scheduleRefresh);
    },
  };
}
