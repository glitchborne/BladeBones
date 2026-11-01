/** Present existing attachment/setup operations in the Rig inspector. */
export function createRigAttachment({ root, bindSelectedArtwork, runAction }) {
  const panel = document.createElement('section');
  panel.className = 'workflow-rig-properties';
  const heading = document.createElement('h3');
  heading.textContent = 'Rig attachment';
  const label = document.createElement('label');
  label.htmlFor = 'workflowParentBone';
  label.textContent = 'Attach artwork to bone';
  const select = document.createElement('select');
  select.id = 'workflowParentBone';
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Keeps the artwork in place while changing its parent.';
  panel.append(heading, label, select, note);

  const setup = document.createElement('details');
  setup.className = 'workflow-setup-properties';
  const summary = document.createElement('summary');
  summary.textContent = 'Setup pose';
  setup.append(summary);
  // These controls own their listeners; workflow-action delegates use a separate availability map.
  for (const [action, text] of [['set-setup', 'Set Bind Pose'], ['restore-setup', 'Restore Setup']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', () => {
      try {
        runAction(action);
      } catch (error) {
        showNotice(error.message);
      }
    });
    setup.append(button);
  }

  function showNotice(message) {
    const notice = root.querySelector('#workflowNotice');
    if (notice) {
      notice.textContent = message;
    }
  }
  select.addEventListener('change', () => {
    const result = bindSelectedArtwork(select.value);
    if (!result.ok) {
      showNotice(result.message);
    }
  });

  let optionSignature = '';
  function refresh(context, mode) {
    const inspector = root.querySelector('.inspector-box');
    if (!inspector) {
      return;
    }
    if (panel.parentNode !== inspector) {
      inspector.append(panel, setup);
    }
    panel.hidden = mode !== 'rig' || context.selection.type !== 'slot';
    setup.hidden = mode !== 'rig' || !context.boneCount;
    const signature = JSON.stringify(context.boneOptions);
    if (signature !== optionSignature) {
      select.replaceChildren(new Option('Unattached', ''));
      for (const bone of context.boneOptions) {
        select.add(new Option(bone.name, bone.id));
      }
      optionSignature = signature;
    }
    if (select.value !== context.parentBoneId) {
      select.value = context.parentBoneId;
    }
    select.disabled = context.isWeightSessionActive || context.isTestPoseActive;
    for (const button of setup.querySelectorAll('button')) {
      button.disabled = context.isWeightSessionActive || context.isTestPoseActive;
    }
  }

  return {
    refresh,
    destroy() {
      panel.remove();
      setup.remove();
    },
  };
}
