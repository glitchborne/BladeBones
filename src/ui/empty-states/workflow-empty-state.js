function setHidden(element, hidden) {
  if (element && element.hidden !== hidden) {
    element.hidden = hidden;
  }
}

function setActionButton(button, action, actions) {
  if (!button) {
    return;
  }

  if (!action) {
    button.removeAttribute('data-workflow-action');
    button.textContent = '';
    button.title = '';
    button.disabled = true;
    setHidden(button, true);
    return;
  }

  const availability = actions[action.name];
  button.textContent = action.label;
  button.dataset.workflowAction = action.name;
  button.disabled = !availability?.enabled;
  setHidden(button, !availability?.visible);
}

/** Update only the workflow guidance region, leaving policy in workflow-view.js. */
export function updateWorkflowEmptyState(root, guidance, actions) {
  const region = root.querySelector('#workflowGuidance');
  const title = root.querySelector('#workflowGuidanceTitle');
  const text = root.querySelector('#workflowGuidanceText');
  const primary = root.querySelector('#workflowPrimaryAction');
  const secondary = root.querySelector('#workflowSecondaryAction');

  setHidden(region, !guidance.visible);
  if (title && title.textContent !== guidance.title) {
    title.textContent = guidance.title;
  }
  if (text && text.textContent !== guidance.text) {
    text.textContent = guidance.text;
  }

  setActionButton(primary, guidance.primary, actions);
  setActionButton(secondary, guidance.secondary, actions);
}
