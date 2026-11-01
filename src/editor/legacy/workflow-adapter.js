/** Build a presentation snapshot without initializing or normalizing the model. */
export function readWorkflowContext(state) {
  const selection = state.selected ?? { type: null, id: null };
  const selectedSlot = selection.type === 'slot'
    ? state.slots.find((slot) => slot.id === selection.id)
    : null;
  const records = {
    bone: state.bones,
    slot: state.slots,
    marker: state.markers,
    camera: state.toon?.cameras ?? [],
  };
  const selected = records[selection.type]?.find((record) => record.id === selection.id);
  const mesh = selectedSlot?.mesh;
  const hasMesh = mesh?.enabled === true && mesh.vertices?.length > 0;
  const hasWeights = mesh?.vertices?.some((vertex) =>
    vertex.weights?.some((weight) => weight.w > 0)
  ) ?? false;
  const trackMaps = ['boneTracks', 'slotTracks', 'deformTracks', 'cameraTracks'];
  const keyCount = trackMaps.reduce((count, field) => count +
    Object.values(state.anim?.[field] ?? {}).reduce((sum, keys) =>
      sum + (Array.isArray(keys) ? keys.length : 0), 0
    ), 0
  );
  const boneOptions = selectedSlot ? state.bones.filter((bone) =>
    !bone.isRoot && bone.id !== state.projectRootId &&
    bone.objectId === selectedSlot.objectId
  ).map((bone) => ({ id: bone.id, name: bone.name })) : [];

  return {
    documentType: state.documentType,
    projectName: state.projectName,
    legacyMode: state.mode,
    tool: state.tool,
    gizmoMode: state.gizmoMode,
    selection: { type: selection.type, id: selection.id, name: selected?.name ?? '' },
    objectCount: state.objects.length,
    artworkCount: state.attachments.length,
    slotCount: state.slots.length,
    boneCount: state.bones.filter((bone) =>
      !bone.isRoot && !bone.objectRoot && bone.id !== state.projectRootId
    ).length,
    hasMesh,
    hasBinding: Boolean(selectedSlot?.bone && selectedSlot.bone !== state.projectRootId) ||
      hasWeights,
    canDeform: hasMesh,
    meshContext: state.meshEdit?.enabled ? state.meshEdit.tool : null,
    meshTab: state.meshEdit?.workbenchTab ?? 'binding',
    isWeightSessionActive: state.meshEdit?.weightPaintSession?.active === true,
    isTestPoseActive: state.rig?.testPose?.active === true,
    playing: state.playing,
    canUndo: state.undo?.length > 0,
    canRedo: state.redo?.length > 0,
    clipCount: state.animations.length,
    keyCount,
    parentBoneId: selectedSlot?.bone ?? '',
    boneOptions,
  };
}

/** Temporary classic-script boundary. All model actions are existing commands. */
export function createLegacyWorkflowAdapter({ state, commands, views, root }) {
  function activateMode(mode) {
    const context = readWorkflowContext(state);
    if (context.isWeightSessionActive || context.isTestPoseActive) {
      return mode === root.dataset.workflow
        ? { ok: true }
        : { ok: false, message: 'Finish or cancel the current preview session before switching stages.' };
    }

    if (mode !== 'animate' && state.playing) {
      commands.stopPlayback();
      if (state.mode === 'skeleton') {
        commands.restoreBindPose({ push: false, clearDeform: true });
      }
    }
    const targetMode = mode === 'animate' ? 'pose' : 'skeleton';
    commands.setMode(targetMode);
    if (state.mode !== targetMode) {
      return { ok: false, message: 'Finish the current edit before switching stages.' };
    }

    if (mode !== 'mesh') {
      state.meshEdit.enabled = false;
      commands.setTool('select');
    } else if (context.selection.type === 'slot') {
      const tab = context.hasMesh ? context.meshTab : 'binding';
      commands.setMeshWorkbenchTab(tab);
    }
    views.setOutlinerTab(mode === 'art' || mode === 'mesh' ? 'draw' : 'rig');
    views.renderAll();
    return { ok: true };
  }

  function clickControl(selector) {
    const control = root.querySelector(selector);
    if (!control) {
      throw new Error('The requested control is unavailable. Select the relevant artwork first.');
    }
    control.click();
  }

  function selectStage(mode) {
    clickControl('[data-workflow-mode="' + mode + '"]');
  }

  function requireDocument() {
    if (!['game', 'toon'].includes(state.documentType)) {
      throw new Error('Create or open a project first.');
    }
  }

  function prepareBoneCreationContext() {
    if (state.meshEdit?.weightPaintSession?.active || state.rig?.testPose?.active) {
      return;
    }
    const selectedBone = state.selected.type === 'bone'
      ? state.bones.find((bone) => bone.id === state.selected.id)
      : null;
    if (selectedBone && selectedBone.id !== state.projectRootId) {
      return;
    }
    const artwork = state.selected.type === 'slot'
      ? state.slots.find((slot) => slot.id === state.selected.id)
      : null;
    const object = state.objects.find((item) => item.id === (artwork?.objectId ?? state.activeObjectId));
    if (object?.root) {
      // The legacy drag command uses selectedBone as parent, otherwise the project root.
      commands.select('bone', object.root);
    }
  }

  function runAction(action) {
    if (action === 'new-project') {
      clickControl('#newProjectBtn');
      return;
    }
    requireDocument();
    const context = readWorkflowContext(state);
    if (context.isWeightSessionActive || context.isTestPoseActive) {
      throw new Error('Apply or cancel the active session before starting another action.');
    }

    switch (action) {
      case 'import-art':
        clickControl('#pngInput');
        break;
      case 'create-bone':
        selectStage('rig');
        prepareBoneCreationContext();
        commands.setTool('bone');
        break;
      case 'create-mesh':
        selectStage('mesh');
        commands.setMeshWorkbenchTab('mesh');
        if (!root.querySelector('#wbMeshEnabled')?.checked) {
          clickControl('#wbMeshEnabled');
        }
        break;
      case 'bind-mesh':
        selectStage('mesh');
        commands.setMeshWorkbenchTab('binding');
        break;
      case 'switch-rig':
        selectStage('rig');
        break;
      case 'switch-mesh':
        selectStage('mesh');
        break;
      case 'switch-animate':
        selectStage('animate');
        break;
      case 'add-key':
        selectStage('animate');
        commands.keySelected();
        break;
      case 'preview-play': {
        const wasPlaying = state.playing;
        selectStage('animate');
        commands.setPlaying(!wasPlaying);
        break;
      }
      case 'preview-stop':
        commands.stopPlayback();
        break;
      case 'set-setup':
        commands.setBindPoseFromCurrent({ rebind: true });
        break;
      case 'restore-setup':
        commands.restoreBindPose({ push: true, clearDeform: true });
        break;
      default:
        throw new Error('Unknown workflow action: ' + action);
    }
  }

  function bindSelectedArtwork(parentBoneId) {
    const context = readWorkflowContext(state);
    if (state.loading || context.selection.type !== 'slot' || context.isWeightSessionActive ||
        context.isTestPoseActive || state.mode !== 'skeleton') {
      return { ok: false, message: 'Select artwork in Rig before changing its parent.' };
    }
    if (parentBoneId && !context.boneOptions.some((bone) => bone.id === parentBoneId)) {
      return { ok: false, message: 'The selected parent no longer belongs to this artwork object.' };
    }
    if (context.parentBoneId === parentBoneId) {
      return { ok: true };
    }
    commands.pushUndo();
    if (!commands.setSlotParentBone(context.selection.id, parentBoneId || null, true)) {
      state.undo.pop();
      return { ok: false, message: 'The artwork could not be attached to that bone.' };
    }
    commands.changed();
    views.renderAll();
    return { ok: true };
  }

  return {
    readContext: () => readWorkflowContext(state),
    activateMode,
    runAction,
    bindSelectedArtwork,
    prepareBoneCreationContext,
  };
}
