const WORKFLOW_COPY = Object.freeze({
  art: Object.freeze({
    label: 'Artwork',
    description: 'Import and arrange artwork, then choose rigid or deformable setup.',
  }),
  mesh: Object.freeze({
    label: 'Mesh',
    description: 'Create deformation topology before building the skeleton.',
  }),
  rig: Object.freeze({
    label: 'Rig',
    description: 'Create bones, attach artwork and bind prepared meshes to the skeleton.',
  }),
  animate: Object.freeze({
    label: 'Animation',
    description:
      'Add keys and preview motion. Rigid animation does not require binding or weights.',
  }),
});

export function hasWorkflowDocument(context) {
  return context?.documentType === 'game' || context?.documentType === 'toon';
}

function selectedSlot(context) {
  return context?.selection?.type === 'slot' && Boolean(context.selection.id);
}

function selectedBone(context) {
  return context?.selection?.type === 'bone' && Boolean(context.selection.id);
}

function count(context, name) {
  const value = Number(context?.[name]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function createActionState(visible, enabled, title = '') {
  return { visible, enabled, title };
}

function createActionStates(context, mode) {
  const documentExists = hasWorkflowDocument(context);
  const slotSelected = selectedSlot(context);
  const boneSelected = selectedBone(context);
  const meshExists = Boolean(context?.hasMesh);
  const bound = Boolean(context?.hasBinding);
  const deformable = Boolean(context?.canDeform);
  const boneCount = count(context, 'boneCount');
  const clipCount = count(context, 'clipCount');
  const playing = Boolean(context?.playing);

  return {
    'new-project': createActionState(true, true),
    'import-art': createActionState(
      documentExists,
      documentExists,
      'Create a project before importing artwork.'
    ),
    'create-bone': createActionState(
      documentExists && (mode === 'rig' || boneCount === 0),
      documentExists,
      'Create or open a project before creating bones.'
    ),
    'create-mesh': createActionState(
      mode === 'mesh' && slotSelected && !meshExists,
      documentExists && slotSelected && !meshExists,
      !documentExists
        ? 'Create or open a project first.'
        : !slotSelected
          ? 'Select an artwork slot first.'
          : meshExists
            ? 'This artwork already has an enabled mesh.'
            : ''
    ),
    'bind-mesh': createActionState(
      documentExists && mode === 'rig' && slotSelected && meshExists && deformable && !bound,
      documentExists && slotSelected && meshExists && deformable && !bound,
      !documentExists
        ? 'Create or open a project first.'
        : !slotSelected
          ? 'Select artwork with an enabled mesh first.'
          : !meshExists
            ? 'Create an enabled mesh first.'
            : !deformable
              ? 'This mesh is not available for deformation.'
              : bound
                ? 'This mesh already has a binding.'
                : ''
    ),
    'switch-rig': createActionState(
      mode !== 'rig',
      documentExists,
      'Create or open a project first.'
    ),
    'switch-mesh': createActionState(
      mode !== 'mesh',
      documentExists && slotSelected,
      !documentExists
        ? 'Create or open a project first.'
        : !slotSelected
          ? 'Select an artwork slot first.'
          : ''
    ),
    'switch-animate': createActionState(
      mode !== 'animate',
      documentExists,
      'Create or open a project first.'
    ),
    'preview-play': createActionState(
      documentExists && clipCount > 0 && !playing,
      documentExists && clipCount > 0 && !playing,
      clipCount === 0 ? 'Create an animation clip first.' : ''
    ),
    'preview-stop': createActionState(
      playing,
      playing,
      'Playback is not running.'
    ),
    'add-key': createActionState(
      mode === 'animate' && (boneCount > 0 || slotSelected || boneSelected),
      documentExists && (slotSelected || boneSelected),
      !documentExists
        ? 'Create or open a project first.'
        : 'Select artwork or a bone before adding a key.'
    ),
  };
}

function createGuidance(context, mode, actions) {
  const noGuidance = { visible: false, title: '', text: '', primary: null, secondary: null };
  const primary = (label, name) => ({ label, name });

  if (!hasWorkflowDocument(context)) {
    return {
      visible: true,
      title: 'Start a project',
      text: 'Create a GameDoc or ToonDoc to begin.',
      primary: primary('New Project', 'new-project'),
      secondary: null,
    };
  }

  if (mode === 'art') {
    if (count(context, 'artworkCount') === 0) {
      return {
        visible: true,
        title: 'Bring in artwork',
        text: 'Import an image to add the first artwork item to this document.',
        primary: primary('Import Image', 'import-art'),
        secondary: null,
      };
    }

    if (selectedSlot(context) && !context.hasMesh) {
      return {
        visible: true,
        title: 'Choose how this artwork moves',
        text:
          'If it needs to bend, prepare a mesh before rigging. Rigid pieces can skip Mesh.',
        primary: primary('Mesh / Prepare', 'switch-mesh'),
        secondary: primary('Rig / Skip Mesh', 'switch-rig'),
      };
    }

    if (selectedSlot(context) && context.hasMesh) {
      return {
        visible: true,
        title: 'Mesh is prepared',
        text: 'Continue to Rig to draw bones and bind the artwork.',
        primary: primary('Continue to Rig', 'switch-rig'),
        secondary: null,
      };
    }

    return noGuidance;
  }

  if (mode === 'rig') {
    if (count(context, 'boneCount') === 0) {
      return {
        visible: true,
        title: 'Start the rig',
        text: 'Create a bone, then place it over the artwork you want to control.',
        primary: primary('Create Bone', 'create-bone'),
        secondary: null,
      };
    }

    if (selectedSlot(context) && context.hasMesh && context.canDeform && !context.hasBinding) {
      return {
        visible: true,
        title: 'Bind the mesh',
        text: 'The topology is ready. Attach it to the rig and assign bone weights.',
        primary: primary('Open Binding', 'bind-mesh'),
        secondary: null,
      };
    }

    return noGuidance;
  }

  if (mode === 'mesh') {
    if (!selectedSlot(context)) {
      if (count(context, 'artworkCount') === 0) {
        return {
          visible: true,
          title: 'Import artwork first',
          text: 'Import an image, then select its artwork slot to edit a mesh.',
          primary: primary('Import Image', 'import-art'),
          secondary: null,
        };
      }

      return {
        visible: true,
        title: 'Select artwork',
        text: 'Select artwork in Hierarchy to edit its mesh.',
        primary: null,
        secondary: null,
      };
    }

    if (!context.hasMesh) {
      return {
        visible: true,
        title: 'Create a mesh',
        text: 'This artwork has no enabled mesh yet.',
        primary: primary('Create Mesh', 'create-mesh'),
        secondary: null,
      };
    }

    if (context.hasMesh) {
      return {
        visible: true,
        title: 'Topology ready',
        text: 'Continue to Rig to create bones, attach the artwork and bind weights.',
        primary: primary('Continue to Rig', 'switch-rig'),
        secondary: null,
      };
    }

    return noGuidance;
  }

  if (mode === 'animate') {
    if (
      count(context, 'boneCount') === 0 &&
      !selectedSlot(context) &&
      !selectedBone(context)
    ) {
      return {
        visible: true,
        title: 'Add a rig bone',
        text: 'Create a bone in Rig before recording bone motion.',
        primary: primary('Create Bone', 'create-bone'),
        secondary: null,
      };
    }

    if (count(context, 'keyCount') === 0) {
      const addKey = actions['add-key'];
      return {
        visible: true,
        title: 'Start an animation',
        text: 'Select artwork or a bone and add a key to begin shaping motion.',
        primary: addKey.visible ? primary('Add Key', 'add-key') : null,
        secondary: null,
      };
    }
  }

  return noGuidance;
}

/**
 * Build detached labels, next-step guidance and action availability for one workflow.
 * The input is read only; counts never imply that an entire workflow is complete.
 * @returns {{ mode: string, label: string, description: string, selectionLabel: string,
 *   guidance: object, actions: Record<string, { visible: boolean, enabled: boolean,
 *   title: string }> }}
 */
export function buildWorkflowView(context, mode) {
  const selectedMode = Object.hasOwn(WORKFLOW_COPY, mode) ? mode : 'art';
  const selection = context?.selection;
  const typeLabels = {
    slot: 'Artwork',
    bone: 'Bone',
    marker: 'Marker',
    object: 'Object',
  };
  const selectionLabel = selection?.id
    ? `${typeLabels[selection.type] ?? 'Selection'}: ${selection.name || selection.id}`
    : 'No selection';
  const actions = createActionStates(context, selectedMode);

  return {
    mode: selectedMode,
    label: WORKFLOW_COPY[selectedMode].label,
    description: WORKFLOW_COPY[selectedMode].description,
    selectionLabel,
    guidance: createGuidance(context, selectedMode, actions),
    actions,
  };
}
