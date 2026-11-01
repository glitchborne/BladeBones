/** Prepare the existing bone tool's selection context; retain its original handlers. */
export function createRigToolContext({ root, readContext, prepareBoneCreationContext }) {
  function handleClick(event) {
    if (event.target.closest('#toolBone')) {
      prepareBoneCreationContext();
    }
  }

  function handleKeydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey ||
        event.target.closest?.('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    const context = readContext();
    const isMeshNumberKey = context.selection.type === 'slot' && context.meshContext;
    if (event.key.toLowerCase() === 'b' || (event.key === '2' && !isMeshNumberKey)) {
      prepareBoneCreationContext();
    }
  }

  root.addEventListener('click', handleClick, true);
  root.ownerDocument.addEventListener('keydown', handleKeydown, true);
  return {
    destroy() {
      root.removeEventListener('click', handleClick, true);
      root.ownerDocument.removeEventListener('keydown', handleKeydown, true);
    },
  };
}
