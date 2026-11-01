# Architecture Notes for Haxe + Kha Rewrite

## Core separation recommended

The JS prototype intentionally keeps many systems global. In the Haxe/Kha app, split them early:

```text
EditorApp
  ProjectModel
  SceneModel
  RigModel
  AnimationModel
  SelectionModel
  CommandStack
  ViewportController
  TimelineController
  InspectorController
  AssetManager
  ExportPipeline
```

## Project model

Recommended top-level types:

```text
Project
  id
  version
  assets: Asset[]
  skeleton: Skeleton
  slots: Slot[]
  markers: Marker[]
  poses: Pose[]
  animations: AnimationClip[]
  editorState: EditorState
```

Keep editor state separate from runtime/export data. The runtime should not need dock layout, selected keys, collapsed panels, etc.

## Command stack

Every user edit should become a command:

```text
MoveSlotCommand
RotateBoneCommand
CreateBoneCommand
BindSlotCommand
SetKeyCommand
MoveKeysCommand
ScaleKeysCommand
DeleteSelectionCommand
```

This will make undo/redo, collaboration, dirty-state tracking, and future scripting much safer.

## Selection model

Avoid `selected: { type, id }` as the only model. Use:

```text
Selection
  objects: ObjectRef[]
  keys: KeyRef[]
  activeObject: ObjectRef
  activeKey: KeyRef
  mode: Object | Key | Range
```

The JS prototype now has object selection and key selection, but a native editor should make this explicit.

## Timeline model

Treat the timeline as a dope sheet first, graph editor second:

```text
TrackGroup
Track
KeySelection
TimeRange
TimelineFilter
Clipboard
```

Graph editing should use a separate curve model that references animation keys rather than duplicating them.

## Art-first workflow

Keep world-space artwork as a real concept:

- `Slot.boneId = null` means staged artwork.
- Binding should preserve world transform by converting world transform to local bone transform.
- Unbinding should preserve world transform by converting local bone transform back to world transform.

This is one of the most important validated UX decisions from the JS prototype.

## v8 root / color decisions

### Project root

The JS prototype stores `project_root` inside `bones[]` for compatibility, but the native rewrite should consider a more explicit type:

```text
RigRoot / SceneNode
  id
  transform
  animationTrack
  children: Bone[]
```

Do not model root as a normal endpoint-connected bone in the native design. Children under root need local X/Y offsets so the whole character can be moved without collapsing all top-level bone starts onto one endpoint.

### Slot visual channels

Slots now have animatable look channels:

```text
alpha
 tint color
 tint amount
 blend mode
```

For Haxe + Kha, keep these as separate animation channels rather than one monolithic slot key if possible. That will make the graph editor, dope sheet filters and runtime blending cleaner.
