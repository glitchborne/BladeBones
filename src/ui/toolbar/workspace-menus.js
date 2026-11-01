/** Keep compact native details menus dismissible without consuming editor shortcuts. */
export function createWorkspaceMenus(root) {
  const menus = [...root.querySelectorAll('.toolbar-menu')];

  function closeMenus(except = null) {
    for (const menu of menus) {
      if (menu !== except && menu.open) {
        menu.open = false;
      }
    }
  }

  function handlePointerDown(event) {
    closeMenus(event.target.closest('.toolbar-menu'));
  }

  function handleClick(event) {
    const button = event.target.closest('.toolbar-menu-popover button');
    if (button) {
      queueMicrotask(() => closeMenus());
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeMenus();
    }
  }

  root.addEventListener('pointerdown', handlePointerDown, true);
  root.addEventListener('click', handleClick, true);
  root.addEventListener('keydown', handleKeydown);

  return {
    destroy() {
      root.removeEventListener('pointerdown', handlePointerDown, true);
      root.removeEventListener('click', handleClick, true);
      root.removeEventListener('keydown', handleKeydown);
      closeMenus();
    },
  };
}
