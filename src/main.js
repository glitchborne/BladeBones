import { createLegacyWorkflowAdapter } from './editor/legacy/workflow-adapter.js';
import { createContextualPanels } from './ui/inspector/contextual-panels.js';
import { createRigAttachment } from './ui/inspector/rig-attachment.js';
import { createContextualTools } from './ui/toolbar/contextual-tools.js';
import { createRigToolContext } from './ui/toolbar/rig-tool-context.js';
import { createWorkspaceMenus } from './ui/toolbar/workspace-menus.js';
import { createWorkflowController } from './ui/workspace/workflow-controller.js';

/** Compose the workflow UI after the existing classic-script bootstrap is ready. */
export function mountWorkflow({ root, state, commands, views }) {
  const adapter = createLegacyWorkflowAdapter({ root, state, commands, views });
  const panels = createContextualPanels({ root, runAction: adapter.runAction });
  const attachment = createRigAttachment({ root, ...adapter });
  const menus = createWorkspaceMenus(root);
  const rigTools = createRigToolContext({ root, ...adapter });
  const tools = createContextualTools(root);
  let resizeFrame = 0;

  function refreshPresentation(context, mode) {
    panels.refresh(context, mode);
    attachment.refresh(context, mode);
    tools.refresh();
    const hasArtworkSelection = context.selection.type === 'slot';
    root.dataset.hasSlotSelection = String(hasArtworkSelection);
    root.dataset.activeTool = context.tool;
    for (const [id, enabled] of [
      ['saveProjectFolder', ['game', 'toon'].includes(context.documentType)],
      ['undo', context.canUndo],
      ['redo', context.canRedo],
    ]) {
      const button = root.querySelector('#' + id);
      if (button && button.disabled !== !enabled) {
        button.disabled = !enabled;
      }
    }
    const toolStatus = root.querySelector('#toolStatus');
    const tool = { select: 'Select', bone: 'Create Bone', pan: 'Pan' }[context.tool] ?? 'Select';
    const transform = { move: 'Move', rotate: 'Rotate', scale: 'Scale' }[context.gizmoMode];
    const toolLabel = tool === 'Select' && transform ? tool + ' / ' + transform : tool;
    if (toolStatus && toolStatus.textContent !== toolLabel) {
      toolStatus.textContent = toolLabel;
    }
    const canPaint = context.hasMesh && context.boneCount > 0;
    for (const selector of ['#meshWorkbenchTabWeights', '#wbFlowGoWeights']) {
      const button = root.querySelector(selector);
      if (button) {
        button.disabled = !canPaint;
        button.title = canPaint ? 'Bind and paint mesh weights (Shift+W)' : 'Create a mesh and bones first.';
      }
    }
    for (const selector of ['#wbWeightStartPaint', '#wbWeightStartAdjust']) {
      const button = root.querySelector(selector);
      if (button?.disabled && button.title !== 'Choose an active bone in Weight context first.') {
        button.title = 'Choose an active bone in Weight context first.';
      }
    }
  }

  const controller = createWorkflowController({ root, ...adapter, onRefresh: refreshPresentation });
  const observer = new ResizeObserver(() => {
    if (resizeFrame) {
      return;
    }
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      views.sizeCanvas();
      views.renderTimeline();
    });
  });
  observer.observe(root.querySelector('.viewport-canvas-wrap'));
  controller.selectMode('art');
  controller.refresh();
  root.dataset.workflowReady = 'true';

  return {
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      controller.destroy();
      panels.destroy();
      attachment.destroy();
      menus.destroy();
      rigTools.destroy();
      tools.destroy();
      delete root.dataset.workflowReady;
    },
  };
}
