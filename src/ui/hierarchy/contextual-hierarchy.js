const HIERARCHY_ROOTS = ['#sceneOutliner', '#objectRigTree', '#drawOrderList'];

const ROW_KIND_LABELS = {
  attachment: 'Attachment',
  bone: 'Bone',
  marker: 'Marker',
  object: 'Object',
  slot: 'Slot',
};

const ROW_KIND_SHORT_LABELS = {
  attachment: 'Att.',
  bone: 'Bone',
  marker: 'Mark',
  object: 'Obj',
  slot: 'Slot',
};

/**
 * Adds compact, accessible labels to existing legacy hierarchy rows in place.
 * Rows retain their original nodes, inline handlers, selection classes and drag behavior.
 *
 * @param {{ root: Element }} options
 * @returns {{ refresh: (context: object, mode?: string) => void, destroy: () => void }}
 */
export function createContextualHierarchy({ root }) {
  if (!root?.querySelector || !root.ownerDocument) {
    throw new TypeError('createContextualHierarchy requires a DOM root element.');
  }

  const decoratedRows = new WeakSet();
  const priorAttributes = new WeakMap();
  const document = root.ownerDocument;
  const disclosures = [];

  function disclose(nodes, text) {
    if (!nodes.length) {
      return;
    }
    const details = document.createElement('details');
    details.className = 'workflow-hierarchy-details';
    const summary = document.createElement('summary');
    summary.textContent = text;
    nodes[0].before(details);
    details.append(summary, ...nodes);
    disclosures.push(details);
  }

  const documentPanel = root.querySelector('#documentPanel');
  if (documentPanel) {
    disclose([documentPanel], 'Document settings');
  }
  const filters = root.querySelector('.outliner-rig-box .outliner-filters');
  if (filters) {
    const roleFilter = filters.nextElementSibling;
    disclose(roleFilter?.querySelector('#outlinerRoleFilter')
      ? [filters, roleFilter] : [filters], 'Hierarchy filters');
  }

  function findRoots() {
    const roots = [];
    for (const selector of HIERARCHY_ROOTS) {
      if (root.matches?.(selector)) {
        roots.push(root);
      } else {
        const element = root.querySelector(selector);
        if (element) {
          roots.push(element);
        }
      }
    }

    if (root.matches?.('.tree-list') && !roots.includes(root)) {
      roots.push(root);
    }

    return roots;
  }

  function rememberAttribute(element, name) {
    let attributes = priorAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      priorAttributes.set(element, attributes);
    }

    if (!attributes.has(name)) {
      attributes.set(name, element.hasAttribute(name) ? element.getAttribute(name) : null);
    }
  }

  function restoreAttribute(element, name) {
    const previous = priorAttributes.get(element)?.get(name);
    if (previous === null) {
      element.removeAttribute(name);
    } else if (previous !== undefined) {
      element.setAttribute(name, previous);
    }
  }

  function rowKind(row) {
    for (const kind of Object.keys(ROW_KIND_LABELS)) {
      if (row.classList.contains(kind)) {
        return kind;
      }
    }

    return '';
  }

  function addKindLabel(row, kind) {
    const meta = row.querySelector('.tree-meta');
    if (!meta) {
      return;
    }

    let label = meta.querySelector(':scope > .contextual-tree-kind');
    if (!label) {
      label = document.createElement('span');
      label.className = 'contextual-tree-kind';
      meta.insertBefore(label, meta.firstChild);
    }

    const labelText = ROW_KIND_SHORT_LABELS[kind];
    if (label.textContent !== labelText) {
      label.textContent = labelText;
    }
  }

  function decorateRow(row) {
    const kind = rowKind(row);
    if (!kind) {
      return;
    }

    const icon = row.querySelector('.tree-icon');
    if (icon) {
      rememberAttribute(icon, 'aria-hidden');
      if (icon.getAttribute('aria-hidden') !== 'true') {
        icon.setAttribute('aria-hidden', 'true');
      }
    }

    addKindLabel(row, kind);

    const name = row.querySelector('.tree-name')?.textContent.trim() || '';
    const metadata = row.querySelector('.tree-meta')?.textContent.trim() || '';
    const title = name + (metadata ? ' / ' + metadata : '');
    rememberAttribute(row, 'title');
    if (row.title !== title) {
      row.title = title;
    }
    const selected = row.classList.contains('on') || row.classList.contains('multi');
    const label = `${ROW_KIND_LABELS[kind]}: ${name}${selected ? ', selected' : ''}`;
    rememberAttribute(row, 'aria-label');
    if (row.getAttribute('aria-label') !== label) {
      row.setAttribute('aria-label', label);
    }

    rememberAttribute(row, 'data-contextual-kind');
    if (row.dataset.contextualKind !== kind) {
      row.dataset.contextualKind = kind;
    }

    rememberAttribute(row, 'data-contextual-selected');
    const selectedValue = String(selected);
    if (row.dataset.contextualSelected !== selectedValue) {
      row.dataset.contextualSelected = selectedValue;
    }

    if (!decoratedRows.has(row)) {
      decoratedRows.add(row);
      row.dataset.contextualDecorated = 'true';
    }
  }

  function refresh(context, mode = '') {
    for (const hierarchyRoot of findRoots()) {
      if (hierarchyRoot.dataset.contextualMode !== mode) {
        hierarchyRoot.dataset.contextualMode = mode;
      }

      hierarchyRoot.querySelectorAll('.tree-row').forEach(decorateRow);
    }
  }

  function destroy() {
    for (const details of disclosures) {
      details.before(...Array.from(details.children).filter((node) => node.tagName !== 'SUMMARY'));
      details.remove();
    }
    for (const hierarchyRoot of findRoots()) {
      hierarchyRoot.querySelectorAll('.contextual-tree-kind').forEach(label => label.remove());
      hierarchyRoot.querySelectorAll('.tree-icon[aria-hidden="true"]').forEach(icon => {
        restoreAttribute(icon, 'aria-hidden');
      });
      hierarchyRoot.querySelectorAll('.tree-row[data-contextual-decorated="true"]').forEach(row => {
        restoreAttribute(row, 'aria-label');
        restoreAttribute(row, 'title');
        restoreAttribute(row, 'data-contextual-kind');
        restoreAttribute(row, 'data-contextual-selected');
        delete row.dataset.contextualDecorated;
      });
      delete hierarchyRoot.dataset.contextualMode;
    }

  }

  return { refresh, destroy };
}
