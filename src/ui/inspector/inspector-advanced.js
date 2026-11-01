const ADVANCED_TABS = new Set(['data', 'elastic', 'advanced', 'diagnostics']);

const HIDDEN_TABS_BY_MODE = {
  art: new Set(['rig', 'animation', 'deform', 'elastic']),
  rig: new Set(['animation', 'deform']),
  mesh: new Set(['rig', 'animation', 'deform', 'elastic']),
  animate: new Set(['rig', 'elastic']),
};

const COMMON_CONTROL_IDS = new Set([
  'camName', 'camX', 'camY', 'camR', 'camZ',
  'iX', 'iY', 'iR', 'iLen', 'iSX', 'iSY',
  'sX', 'sY', 'sR', 'sSX', 'sSY', 'sName', 'sAtt',
]);

/**
 * Groups legacy inspector tabs and technical controls behind native disclosures.
 * The controls remain the original nodes so their IDs and event handlers survive.
 *
 * @param {{ root: Element }} options
 * @returns {{
 *   refresh: (inspector: Element, context: object, mode: string) => string,
 *   destroy: () => void,
 * }}
 */
export function createInspectorAdvancedPresentation({ root }) {
  if (!root?.querySelector || !root.ownerDocument) {
    throw new TypeError('createInspectorAdvancedPresentation requires a DOM root element.');
  }

  const document = root.ownerDocument;
  const expandedDetails = new Map();
  const priorTabStates = new WeakMap();
  let currentSelectionKey = '';
  let tabbarRoot = null;
  let disclosureClickHandler = null;
  let isRefreshing = false;

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

  function initialDetailsOpen(key, initiallyOpen) {
    if (!expandedDetails.has(key)) {
      expandedDetails.set(key, initiallyOpen);
    }

    return expandedDetails.get(key);
  }

  function syncOpen(details, key, initiallyOpen) {
    const open = initialDetailsOpen(key, initiallyOpen);
    if (details.open !== open) {
      details.open = open;
    }
  }

  function keepsCommonInspectorControlVisible(node) {
    if (node.nodeType !== 1) {
      return false;
    }

    if (node.matches(
      '.inspector-title, .contextual-selection-heading, .contextual-guidance-actions'
    )) {
      return true;
    }

    if (COMMON_CONTROL_IDS.has(node.id)) {
      return true;
    }

    return Array.from(COMMON_CONTROL_IDS).some(id => node.querySelector('[id="' + id + '"]'));
  }

  function handleDisclosureClick(event) {
    const button = event.target.closest?.('.contextual-advanced-tabs .tab-button');
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

  function ensureDisclosureListener(tabbar) {
    if (tabbarRoot === tabbar) {
      return;
    }

    if (tabbarRoot && disclosureClickHandler) {
      tabbarRoot.removeEventListener('click', disclosureClickHandler);
    }

    tabbarRoot = tabbar;
    disclosureClickHandler = handleDisclosureClick;
    tabbarRoot?.addEventListener('click', disclosureClickHandler);
  }

  function activeTabLabel(tabbar) {
    const active = tabbar?.querySelector('.tab-button.on');
    return active ? active.textContent.trim().toLowerCase() : '';
  }

  function moveAdvancedTabs(tabbar, selectionKey, activeLabel) {
    if (!tabbar) {
      return;
    }

    let disclosure = tabbar.querySelector(':scope > details.contextual-advanced-tabs');
    if (!disclosure) {
      disclosure = document.createElement('details');
      disclosure.className = 'contextual-disclosure contextual-advanced-tabs';
      disclosure.dataset.stateKey = detailStateKey(selectionKey, 'advanced-tabs');

      const summary = document.createElement('summary');
      summary.textContent = 'Advanced';

      const list = document.createElement('div');
      list.className = 'contextual-advanced-tab-list';
      disclosure.append(summary, list);
      tabbar.appendChild(disclosure);
    }

    const stateKey = detailStateKey(selectionKey, 'advanced-tabs');
    if (disclosure.dataset.stateKey !== stateKey) {
      disclosure.dataset.stateKey = stateKey;
    }

    const list = disclosure.querySelector('.contextual-advanced-tab-list');
    const tabs = Array.from(tabbar.querySelectorAll(':scope > .tab-button'));
    for (const tab of tabs) {
      const label = tab.textContent.trim().toLowerCase();
      if (ADVANCED_TABS.has(label) && tab.parentElement !== list) {
        list.appendChild(tab);
      }
    }

    const shouldHide = list.children.length === 0;
    if (disclosure.hidden !== shouldHide) {
      disclosure.hidden = shouldHide;
    }

    const initiallyOpen = ADVANCED_TABS.has(activeLabel);
    syncOpen(disclosure, stateKey, initiallyOpen);
  }

  function applyTabVisibility(tabbar, hiddenTabs, canDeform) {
    for (const button of tabbar.querySelectorAll('.tab-button')) {
      const label = button.textContent.trim().toLowerCase();
      const shouldHide = hiddenTabs.has(label) || (label === 'deform' && !canDeform);
      if (!priorTabStates.has(button)) {
        priorTabStates.set(button, {
          ariaHidden: button.hasAttribute('aria-hidden')
            ? button.getAttribute('aria-hidden')
            : null,
          hidden: button.hidden,
        });
      }
      if (button.hidden !== shouldHide) {
        button.hidden = shouldHide;
      }

      const ariaHidden = String(shouldHide);
      if (button.getAttribute('aria-hidden') !== ariaHidden) {
        button.setAttribute('aria-hidden', ariaHidden);
      }
    }
  }

  function visibleFallbackTab(tabbar, context) {
    const labels = context.selection?.type === 'camera'
      ? ['camera', 'transform']
      : ['transform', 'camera'];

    return Array.from(tabbar.querySelectorAll('.tab-button')).find(button => {
      return !button.hidden && labels.includes(button.textContent.trim().toLowerCase());
    }) || null;
  }

  function configureTabs(tabbar, context, mode, selectionKey) {
    if (!tabbar) {
      return '';
    }

    ensureDisclosureListener(tabbar);
    const hiddenTabs = HIDDEN_TABS_BY_MODE[mode] || new Set();
    const canDeform = context.selection?.type === 'slot' && context.canDeform === true;
    moveAdvancedTabs(tabbar, selectionKey, activeTabLabel(tabbar));
    applyTabVisibility(tabbar, hiddenTabs, canDeform);

    let currentTabbar = findElement('#inspectorTabs');
    let activeButton = currentTabbar?.querySelector('.tab-button.on');
    if (activeButton?.hidden) {
      const fallback = visibleFallbackTab(currentTabbar, context);
      if (fallback) {
        // The legacy handler updates state and replaces inspector content for the chosen tab.
        fallback.click();
        currentTabbar = findElement('#inspectorTabs');
        if (currentTabbar) {
          ensureDisclosureListener(currentTabbar);
          moveAdvancedTabs(currentTabbar, selectionKey, activeTabLabel(currentTabbar));
          applyTabVisibility(currentTabbar, hiddenTabs, canDeform);
          activeButton = currentTabbar.querySelector('.tab-button.on');
        }
      }

      // Keep legacy content reachable if a custom inspector has no fallback tab.
      if (activeButton?.hidden) {
        activeButton.hidden = false;
        activeButton.setAttribute('aria-hidden', 'false');
      }
    }

    return activeTabLabel(currentTabbar);
  }

  function getContentDetails(inspector, selectionKey, name, summaryText, initiallyOpen) {
    const selector = ':scope > details.contextual-inspector-details[data-detail-name="' +
      name + '"]';
    let details = inspector.querySelector(selector);
    if (details) {
      const stateKey = detailStateKey(selectionKey, name);
      if (details.dataset.stateKey !== stateKey) {
        details.dataset.stateKey = stateKey;
      }
      syncOpen(details, stateKey, initiallyOpen);
      return details;
    }

    details = document.createElement('details');
    details.className = 'contextual-disclosure contextual-inspector-details';
    details.dataset.detailName = name;
    details.dataset.stateKey = detailStateKey(selectionKey, name);

    const summary = document.createElement('summary');
    summary.textContent = summaryText;

    const content = document.createElement('div');
    content.className = 'contextual-inspector-detail-content';
    details.append(summary, content);

    if (name === 'data') {
      const rawPreview = inspector.querySelector('.raw-preview');
      if (rawPreview) {
        content.appendChild(rawPreview);
      }
    }

    if (content.childNodes.length === 0) {
      const selectionHeading = inspector.querySelector(':scope > .contextual-selection-heading');
      const actionRow = inspector.querySelector(':scope > .contextual-guidance-actions');
      for (const child of Array.from(inspector.childNodes)) {
        if (child !== details && child !== selectionHeading && child !== actionRow &&
            !keepsCommonInspectorControlVisible(child)) {
          content.appendChild(child);
        }
      }
    }

    inspector.appendChild(details);
    syncOpen(details, details.dataset.stateKey, initiallyOpen);
    return details;
  }

  function applyAdvancedContent(inspector, activeLabel, selectionKey, context) {
    if (activeLabel === 'transform' && context.selection?.type === 'slot') {
      getContentDetails(inspector, selectionKey, 'binding-summary', 'Advanced / binding status', false);
    } else if (activeLabel === 'data') {
      getContentDetails(inspector, selectionKey, 'data', 'Data', true);
    } else if (activeLabel === 'elastic') {
      getContentDetails(inspector, selectionKey, 'elastic', 'Elastic bone controls', true);
    } else if (activeLabel === 'advanced' || activeLabel === 'diagnostics') {
      getContentDetails(inspector, selectionKey, 'advanced-content', 'Advanced controls', true);
    }
  }

  function restoreInspectorDetails(inspector) {
    inspector.querySelectorAll('.contextual-inspector-details').forEach(details => {
      const content = details.querySelector('.contextual-inspector-detail-content');
      if (content) {
        while (content.firstChild) {
          details.parentElement.insertBefore(content.firstChild, details);
        }
      }
      details.remove();
    });
  }

  function refresh(inspector, context, mode) {
    if (isRefreshing) {
      return activeTabLabel(findElement('#inspectorTabs'));
    }

    isRefreshing = true;
    try {
      const selectionKey = selectionKeyFor(context, mode);
      if (currentSelectionKey !== selectionKey) {
        expandedDetails.clear();
        currentSelectionKey = selectionKey;
      }

      const tabbar = findElement('#inspectorTabs');
      const activeLabel = configureTabs(tabbar, context, mode, selectionKey);
      const currentInspector = findElement('#inspector') || inspector;
      applyAdvancedContent(currentInspector, activeLabel, selectionKey, context);
      return activeLabel;
    } finally {
      isRefreshing = false;
    }
  }

  function destroy() {
    const inspector = findElement('#inspector');
    if (inspector) {
      restoreInspectorDetails(inspector);
    }

    const tabbar = findElement('#inspectorTabs');
    if (tabbar) {
      const disclosure = tabbar.querySelector(':scope > details.contextual-advanced-tabs');
      const list = disclosure?.querySelector('.contextual-advanced-tab-list');
      if (list) {
        while (list.firstChild) {
          tabbar.insertBefore(list.firstChild, disclosure);
        }
      }
      disclosure?.remove();

      tabbar.querySelectorAll('.tab-button').forEach(button => {
        const previous = priorTabStates.get(button);
        button.hidden = previous?.hidden ?? false;
        if (previous?.ariaHidden === null || previous?.ariaHidden === undefined) {
          button.removeAttribute('aria-hidden');
        } else {
          button.setAttribute('aria-hidden', previous.ariaHidden);
        }
      });
    }

    if (tabbarRoot && disclosureClickHandler) {
      tabbarRoot.removeEventListener('click', disclosureClickHandler);
    }
    tabbarRoot = null;
    disclosureClickHandler = null;
    currentSelectionKey = '';
    expandedDetails.clear();
  }

  return { refresh, destroy };
}
