# Canonical Project Format (v11 editor save)

This document describes the editable project JSON emitted by `exportData()` and consumed by `importData()`. It is separate from the playback schema in [PROJECT_FORMAT_V11.md](PROJECT_FORMAT_V11.md).

## Data paths

```text
Editor model and saved editor preferences
  -> exportData()
  -> Project JSON (local save, autosave, undo snapshot, or project.json folder)
  -> importData()
  -> normalized editor model and restored editor preferences
```

```text
Editor model
  -> buildRuntimeDocument()
  -> Runtime JSON v11
  -> validateRuntimeDocument()
```

ToonDoc camera tracks and object render layers use the same Project JSON path. Clip import/export passes through `normalizeImportedClip()` and `clipForExport()`.

## Canonical project fields

The v11 editor save contains:

- `documentType`, `projectName`, and `toon` settings for ToonDoc documents;
- `objects[]`, including each rig root, parent slot, visibility, and `renderLayerId`;
- `bones[]`, including hierarchy, object ownership, setup/rest and current local transforms, locks, roles, weight participation, and elastic settings;
- `slots[]`, including parent bone, object, attachment, visibility and display settings, local and setup transforms, mesh geometry/topology/weights/bind coordinates, and setup display pose;
- `attachments[]`, `markers[]`, and saved `poses[]`;
- `animations[]`, `activeAnimationId`, and the legacy `animation` alias for the active clip. Each clip stores transform, slot, deform/FFD, camera tracks, interpolation curves/tangents, events, and clip metadata;
- `editor`, a deliberately limited set of view, selection, layout, timeline, workbench, and preference settings. The active `currentTime` is saved and restored so the visible evaluated pose is stable.

The project format preserves editor model fields. Runtime derived fields such as bone world matrices and the currently evaluated slot deform offsets are recomputed from setup data and animation tracks.

## Import normalization and migrations

`importData()` keeps compatibility with older project JSON by applying these defaults and conversions:

- missing document type defaults to GameDoc; old `editor.documentType` and `editor.projectName` are accepted;
- missing ids/names, transforms, visual values, animation duration/rate, and ToonDoc settings receive defaults;
- `parentBone` is accepted as a slot parent alias for `bone`; `tracks` is accepted as the old bone track map alias;
- old projects without objects get a default object around their legacy rig when needed;
- missing ToonDoc camera `setup` values are initialized from the saved camera transform;
- slot meshes receive the current topology version, derived edges/hull, UV defaults, and weight cleanup; partial weight sums up to one are preserved, while malformed overweight data is normalized by the existing model migration;
- imported editor playhead time is clamped by animation evaluation; unavailable selections fall back to valid model selections.

Normalization is intentional for legacy or invalid input. The canonical round-trip tests use valid current-format data and compare the serialized semantic document after normalization.

## Editor-only and transient state

Project JSON stores selected editor preferences and some selection state because it is a resumable editing document. Playback state, the active tool/mode, transient pointer/drag state, runtime world matrices, undo/redo stacks, and the evaluated deform pose are not project fields. Animation tracks and setup data are the source of truth for reevaluating those values.

Runtime JSON has its own smaller playback contract and excludes Project `editor` data entirely.
