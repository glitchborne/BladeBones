/**
 * Gates mesh workbench controls by selection and discloses advanced binding controls.
 * It only moves existing nodes; legacy control IDs and event handlers stay intact.
 *
 * @param {{ root: Element }} options
 * @returns {{ refresh: (context: object, mode: string) => void, destroy: () => void }}
 */
export function createMeshWorkbenchPresentation({ root }) {
  if (!root?.querySelector || !root.ownerDocument) {
    throw new TypeError('createMeshWorkbenchPresentation requires a DOM root element.');
  }

  const document = root.ownerDocument;
  const expandedDetails = new Map();
  const priorWorkbenchStates = new WeakMap();
  let currentSelectionKey = '';
  let workbenchRoot = null;
  let disclosureClickHandler = null;

  function findElement(selector) {
    if (root.matches?.(selector)) {
      return root;
    }

    return root.querySelector(selector);
  }

  function selectionKeyFor(context, mode) {
    const selection = context.selection || {};
    return mode + '|' + (selection.type || '') + '|' + (selection.id || '');
  }

  function detailStateKey(selectionKey, name) {
    return selectionKey + '|' + name;
  }

  function syncOpen(details, key, initiallyOpen) {
    if (!expandedDetails.has(key)) {
      expandedDetails.set(key, initiallyOpen);
    }

    const open = expandedDetails.get(key);
    if (details.open !== open) {
      details.open = open;
    }
  }

  function handleDisclosureClick(event) {
    const button = event.target.closest?.('.contextual-binding-advanced .tab-button');
    if (button) {
      const details = button.closest('details.contextual-disclosure');
      if (details?.dataset.stateKey) {
        expandedDetails.set(details.dataset.stateKey, true);
      }
      return;
    }

    const summary = event.target.closest?.('summary');
    if (!summary) {
      return;
    }

    const details = summary.parentElement;
    if (!details?.matches('details.contextual-disclosure')) {
      return;
    }

    const key = details.dataset.stateKey;
    if (key) {
      expandedDetails.set(key, !details.open);
    }
  }

  function ensureDisclosureListener(workbench) {
    if (workbenchRoot === workbench) {
      return;
    }

    if (workbenchRoot && disclosureClickHandler) {
      workbenchRoot.removeEventListener('click', disclosureClickHandler);
    }

    workbenchRoot = workbench;
    disclosureClickHandler = handleDisclosureClick;
    workbenchRoot?.addEventListener('click', disclosureClickHandler);
  }

  function setHidden(element, hidden) {
    if (element && element.hidden !== hidden) {
      element.hidden = hidden;
    }
  }

  function applyMeshSelectionGate(context) {
    const workbench = findElement('#meshWorkbench');
    if (!workbench) {
      ensureDisclosureListener(null);
      return;
    }

    ensureDisclosureListener(workbench);
    const meshControls = workbench.querySelector(
      '[id^="wbMesh"], [id^="wbWeight"], [id^="wbSlot"], [id^="mesh"], [id^="ffd"]'
    );
    if (!meshControls) {
      // The legacy renderer owns the current empty-workbench state after replacing its contents.
      if (workbench.dataset.contextualHidden) {
        const previous = priorWorkbenchStates.get(workbench);
        workbench.hidden = previous?.hidden ?? false;
      }
      delete workbench.dataset.contextualHidden;
      priorWorkbenchStates.delete(workbench);
      return;
    }

    const selectedCompatibleSlot = context.selection?.type === 'slot' &&
      Boolean(context.selection.id);
    const shouldHide = !selectedCompatibleSlot;
    if (workbench.dataset.contextualHidden !== String(shouldHide)) {
      if (!priorWorkbenchStates.has(workbench)) {
        priorWorkbenchStates.set(workbench, {
          ariaHidden: workbench.hasAttribute('aria-hidden')
            ? workbench.getAttribute('aria-hidden')
            : null,
          hidden: workbench.hidden,
        });
      }
      workbench.dataset.contextualHidden = String(shouldHide);
      workbench.hidden = shouldHide;
      workbench.setAttribute('aria-hidden', String(shouldHide));
    }
  }

  function configureBindingAdvancedTab(selectionKey) {
    const workbench = findElement('#meshWorkbench');
    const advancedButton = workbench?.querySelector('#bindingSubtabAdvanced');
    const subtabBar = advancedButton?.closest('.mesh-binding-subtabs');
    if (!advancedButton || !subtabBar) {
      return;
    }

    let disclosure = subtabBar.querySelector(':scope > details.contextual-binding-advanced');
    if (!disclosure) {
      disclosure = document.createElement('details');
      disclosure.className = 'contextual-disclosure contextual-binding-advanced';

      const summary = document.createElement('summary');
      summary.textContent = 'Advanced';

      const content = document.createElement('div');
      content.className = 'contextual-binding-advanced-content';
      disclosure.append(summary, content);
      subtabBar.appendChild(disclosure);
    }

    const stateKey = detailStateKey(selectionKey, 'binding-advanced-tab');
    if (disclosure.dataset.stateKey !== stateKey) {
      disclosure.dataset.stateKey = stateKey;
    }

    const content = disclosure.querySelector('.contextual-binding-advanced-content');
    if (advancedButton.parentElement !== content) {
      content.appendChild(advancedButton);
    }

    syncOpen(disclosure, stateKey, advancedButton.classList.contains('on'));
  }

  function configureBindingAdvancedContent(selectionKey) {
    const workbench = findElement('#meshWorkbench');
    const grid = workbench?.querySelector('.mesh-workbench-grid.binding-advanced-grid');
    if (!workbench || !grid) {
      return;
    }

    let disclosure = workbench.querySelector(
      ':scope > details.contextual-binding-advanced-content-panel'
    );
    if (!disclosure) {
      disclosure = document.createElement('details');
      disclosure.className = 'contextual-disclosure contextual-binding-advanced-content-panel';

      const summary = document.createElement('summary');
      summary.textContent = 'Advanced controls';

      const content = document.createElement('div');
      content.className = 'contextual-binding-advanced-content-body';
      disclosure.append(summary, content);
      grid.parentElement.insertBefore(disclosure, grid);
    }

    const stateKey = detailStateKey(selectionKey, 'binding-advanced-content');
    if (disclosure.dataset.stateKey !== stateKey) {
      disclosure.dataset.stateKey = stateKey;
    }

    const content = disclosure.querySelector('.contextual-binding-advanced-content-body');
    if (grid.parentElement !== content) {
      content.appendChild(grid);
    }

    const tabIsActive = workbench.querySelector('#bindingSubtabAdvanced')
      ?.classList.contains('on') || false;
    syncOpen(disclosure, stateKey, tabIsActive);
  }

  function restoreBindingDisclosures(workbench) {
    workbench.querySelectorAll('.contextual-binding-advanced').forEach(details => {
      const content = details.querySelector('.contextual-binding-advanced-content');
      if (content) {
        while (content.firstChild) {
          details.parentElement.insertBefore(content.firstChild, details);
        }
      }
      details.remove();
    });

    workbench.querySelectorAll('.contextual-binding-advanced-content-panel').forEach(details => {
      const content = details.querySelector('.contextual-binding-advanced-content-body');
      if (content) {
        while (content.firstChild) {
          details.parentElement.insertBefore(content.firstChild, details);
        }
      }
      details.remove();
    });
  }

  function refresh(context, mode) {
    const selectionKey = selectionKeyFor(context, mode);
    if (currentSelectionKey !== selectionKey) {
      expandedDetails.clear();
      currentSelectionKey = selectionKey;
    }

    applyMeshSelectionGate(context);
    configureBindingAdvancedTab(selectionKey);
    configureBindingAdvancedContent(selectionKey);
  }

  function destroy() {
    const workbench = findElement('#meshWorkbench');
    if (workbench) {
      restoreBindingDisclosures(workbench);

      if (workbench.dataset.contextualHidden) {
        const meshControls = workbench.querySelector(
          '[id^="wbMesh"], [id^="wbWeight"], [id^="wbSlot"], [id^="mesh"], [id^="ffd"]'
        );
        if (meshControls) {
          const previous = priorWorkbenchStates.get(workbench);
          workbench.hidden = previous?.hidden ?? false;
          if (previous?.ariaHidden === null || previous?.ariaHidden === undefined) {
            workbench.removeAttribute('aria-hidden');
          } else {
            workbench.setAttribute('aria-hidden', previous.ariaHidden);
          }
        } else {
          const previous = priorWorkbenchStates.get(workbench);
          workbench.hidden = previous?.hidden ?? false;
        }
        delete workbench.dataset.contextualHidden;
      }
    }

    if (workbenchRoot && disclosureClickHandler) {
      workbenchRoot.removeEventListener('click', disclosureClickHandler);
    }
    workbenchRoot = null;
    disclosureClickHandler = null;
    currentSelectionKey = '';
    expandedDetails.clear();
  }

  return { refresh, destroy };
}
