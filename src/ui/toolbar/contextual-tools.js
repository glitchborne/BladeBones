/** Reuse the existing key controls in the animation tool row. */
const SHORTCUT_TITLES = Object.freeze({
  play: 'Play / pause (Space)',
  prevFrame: 'Previous frame (Left Arrow)',
  nextFrame: 'Next frame (Right Arrow)',
  goStart: 'Go to start (Home)',
  goEnd: 'Go to end (End)',
  wbMeshSelModeVertex: 'Select vertices (1)',
  wbMeshSelModeEdge: 'Select edges (2)',
  wbMeshSelModeFace: 'Select triangles (3)',
  wbMeshActionKnife: 'Knife (K)',
  wbMeshSwapEdge: 'Flip selected edge (F)',
  wbWeightStartPaint: 'Paint weights (P)',
  wbWeightStartAdjust: 'Adjust weights (A)',
  wbWeightApplyPaint: 'Apply weight session (Enter)',
  wbWeightCancelPaint: 'Cancel weight session (Escape)',
});

export function createContextualTools(root) {
  const toolbar = root.querySelector('.toolbar-row-secondary .mode-tools');
  const group = root.ownerDocument.createElement('div');
  group.className = 'workflow-animation-tools toolbar-group';
  group.dataset.workflowOnly = 'animate';
  group.setAttribute('aria-label', 'Animation authoring');
  const moved = [];

  for (const id of ['keySel', 'keyAll', 'autoKey']) {
    const control = root.querySelector('#' + id);
    if (!control) {
      continue;
    }
    const node = id === 'autoKey' ? control.closest('label') : control;
    moved.push({ node, parent: node.parentNode, next: node.nextSibling });
    group.append(node);
  }
  const selectedKey = group.querySelector('#keySel');
  if (selectedKey) {
    selectedKey.title = 'Add a key to the current selection (K)';
  }
  toolbar?.after(group);

  return {
    refresh() {
      for (const [id, title] of Object.entries(SHORTCUT_TITLES)) {
        const control = root.querySelector('#' + id);
        if (control && control.title !== title) {
          control.title = title;
        }
      }
    },
    destroy() {
      for (const { node, parent, next } of moved.reverse()) {
        parent.insertBefore(node, next?.parentNode === parent ? next : null);
      }
      group.remove();
    },
  };
}
