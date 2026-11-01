# Runtime Export Format V11

This document describes the **runtime export** schema emitted by `buildRuntimeDocument()` in `js/persistence.js`.

V11 is not the full editor save file. The full editor save still comes from `exportData()` and includes UI state, layout, selections, workbench tabs, brush settings, diagnostics state, and other editor-only data.

The runtime export is designed for game/runtime playback and future Haxe/Kha integration.

## Top-level document

```json
{
  "format": "indie-2d-runtime",
  "schema": "indie-2d-runtime-v11",
  "version": 11,
  "schemaVersion": "11.0.0",
  "sourceVersion": "indie-2d-v11-stable-runtime-export",
  "documentType": "game",
  "projectName": "Untitled GameDoc",
  "units": {
    "coordinates": "pixels",
    "angles": "degrees",
    "time": "seconds",
    "axis": "2d-y-down"
  },
  "objects": [],
  "bones": [],
  "slots": [],
  "attachments": [],
  "meshes": [],
  "setupPose": {
    "bones": {},
    "slots": {}
  },
  "markers": [],
  "animations": [],
  "activeAnimationId": null,
  "meta": {}
}
```

## Runtime vs editor data

The following editor-only data is intentionally excluded:

```text
editor
selection
hover
brush / paint sessions
layout
view filters
pick filters
diagnostics UI state
test pose state
undo / redo
workbench tabs
```

## Objects

Objects group rig hierarchies and optionally allow nested rigs through `parentSlot`.

```json
{
  "id": "obj1",
  "name": "Object 1",
  "root": "b1",
  "parentSlot": null,
  "visible": true,
  "renderLayerId": "chars"
}
```

For ToonDoc, runtime also contains a `toon` object with the canvas, cameras, active camera id, and render layers. Camera transforms in this object are setup transforms; keyed camera motion belongs in animation `cameraTracks`.

```json
{
  "canvas": { "width": 1920, "height": 1080, "background": "#000000", "transparent": true },
  "cameras": [{ "id": "cam1", "name": "Main Camera", "x": 0, "y": 0, "r": 0, "z": 1 }],
  "activeCameraId": "cam1",
  "renderLayers": [{ "id": "chars", "name": "Characters", "order": 10, "visible": true }]
}
```

## Bones

Bones export their setup/rest transform only. Animation tracks apply on top of this setup pose.

```json
{
  "id": "b3",
  "name": "arm_L",
  "parent": "b2",
  "objectId": "obj1",
  "objectRoot": false,
  "isRoot": false,
  "role": "deform",
  "affectWeights": true,
  "connected": true,
  "moveOnly": false,
  "rest": { "x": 0, "y": 0, "r": 0, "len": 80, "sx": 1, "sy": 1 },
  "width": 12,
  "color": "#88ccff",
  "shape": "bone"
}
```

## Slots

Slots are draw/display nodes attached to bones. Runtime v11 separates slot display state from mesh geometry.

```json
{
  "id": "s1",
  "name": "torso",
  "objectId": "obj1",
  "bone": "b2",
  "attachment": "a1",
  "drawOrder": 0,
  "visible": true,
  "setup": {
    "x": 0,
    "y": 0,
    "r": 0,
    "sx": 1,
    "sy": 1,
    "alpha": 1,
    "tint": "#ffffff",
    "tintAlpha": 0,
    "blendMode": "normal",
    "attachment": "a1",
    "visible": true
  },
  "mesh": "s1:mesh"
}
```

`mesh` is either a mesh id or `null` for rigid/unmeshed attachments.

## Attachments

Attachments describe images or primitive placeholders.

```json
{
  "id": "a1",
  "name": "torso.png",
  "type": "image",
  "w": 256,
  "h": 256,
  "naturalW": 256,
  "naturalH": 256,
  "pivot": { "x": 0.5, "y": 0.5 },
  "color": "#888888",
  "src": "data:image/png;base64,..."
}
```

Folder save/load may rewrite `src` to an external relative asset path.

## Meshes

Runtime v11 stores meshes in a top-level `meshes[]` array. Slots reference meshes by id.

```json
{
  "id": "s1:mesh",
  "slot": "s1",
  "enabled": true,
  "version": 3,
  "vertexCount": 4,
  "triangleCount": 2,
  "vertices": [
    { "x": -50, "y": -50, "u": 0, "v": 0 },
    { "x": 50, "y": -50, "u": 1, "v": 0 }
  ],
  "weights": [
    [ { "bone": "b2", "w": 1, "bind": { "x": -50, "y": -50 } } ],
    [ { "bone": "b2", "w": 0.75, "bind": { "x": 50, "y": -50 } } ]
  ],
  "triangles": [[0, 1, 2], [2, 1, 3]],
  "edges": [[0, 1], [1, 3], [2, 3], [0, 2], [1, 2]],
  "hull": [0, 1, 3, 2],
  "deformSetup": {
    "offsets": [ { "x": 0, "y": 0 } ]
  },
  "weightSumPolicy": "partial-allowed-rest-space"
}
```

### Weight sum policy

Weights may sum to less than `1.0` because the editor supports partial active-bone weights. The remaining amount is treated as implicit rest/local-space influence by the runtime.

Invalid state:

```text
sum(weights) > 1.0
```

Accepted state:

```text
0.0 <= sum(weights) <= 1.0
```

## Setup pose

`setupPose` duplicates the setup transforms in fast lookup maps for runtime initialization.

```json
{
  "setupPose": {
    "bones": {
      "b1": { "x": 0, "y": 0, "r": 0, "len": 80, "sx": 1, "sy": 1 }
    },
    "slots": {
      "s1": { "x": 0, "y": 0, "r": 0, "sx": 1, "sy": 1, "alpha": 1 }
    }
  }
}
```

Runtime playback should reset to this setup pose before applying animation samples.

## Animations

Animation clips use seconds for time and degrees for rotation.

```json
{
  "id": "clip1",
  "name": "walk",
  "duration": 1.2,
  "fps": 24,
  "boneTracks": {
    "b2": [
      { "t": 0, "x": 0, "y": 0, "r": 0, "len": 80, "sx": 1, "sy": 1, "curve": null }
    ]
  },
  "slotTracks": {},
  "deformTracks": {
    "s1": [
      {
        "t": 0.5,
        "offset": 0,
        "offsets": [ { "x": 1, "y": 0 } ],
        "curve": null
      }
    ]
  },
  "cameraTracks": {},
  "events": []
}
```

Deform tracks are keyed by slot id. For a slot with an enabled mesh, every deform key must have an `offsets[]` length that matches that mesh vertex count. ToonDoc camera animation, when present, is exported in `cameraTracks` and camera keys reference camera ids in `toon.cameras`.

Runtime track keys contain playback channels and interpolation data only. Bone keys preserve Hermite tangents, slot keys preserve display/transform channels, camera keys preserve camera transforms, and deform keys preserve offsets and curves. Editor selection or drag metadata on a key is not exported.

The editor has no persistent mesh deform setup separate from animation keys. Runtime export therefore omits optional `mesh.deformSetup`; the current evaluated FFD pose is transient editor state and is not used as runtime setup data.

For ToonDoc, runtime `toon.cameras[]` contains each camera's stable setup transform. The editor stores this setup separately from the currently evaluated camera pose so runtime output does not depend on the timeline playhead. Project JSON initializes this setup from the camera transform when loading older ToonDoc saves.

## Validation

`validateRuntimeDocument()` treats documented structure and references as errors. The intentional warning cases are an empty object list and enabled meshes with no vertices, triangles, or weighted influences for individual vertices.

| Invariant | Valid | Warning | Error |
| --- | --- | --- | --- |
| Objects | Every object root and optional parent slot resolves; ToonDoc render layers resolve | No objects | Missing roots/slots/layers or cyclic object nesting |
| Rig and setup | Bone parents resolve, hierarchy is acyclic, and every bone/slot has finite setup data | — | Broken references, cycles, missing or malformed setup |
| Mesh topology | Parallel vertex/weight arrays and in-range triangle, edge, and hull indices | Enabled mesh has no vertices or triangles | Malformed arrays or invalid indices |
| Weights | Each weight is finite and within `[0, 1]`; per-vertex sum is at most `1.0` within rounding tolerance; bind coordinates and bones resolve | Enabled mesh vertex has no influences | Invalid value/sum, missing bone, or missing bind coordinate |
| Animation | Track maps, keys, curves, event times, camera ids, and deform offsets match the clip and mesh | — | Malformed keys, broken references, or offset-count mismatch |
| ToonDoc | Canvas, active camera, cameras, and render layers are complete | — | Missing or malformed camera/layer data |
| Runtime separation | No editor-only state is present | — | Editor-only field appears in the runtime payload |

It checks:

- top-level format/schema/version;
- unique ids and valid object, bone, slot, attachment, mesh, marker, render-layer, and camera references;
- acyclic bone hierarchy and valid object roots/parent slots;
- missing setup pose entries and malformed setup transforms;
- mesh vertex/weights parallel arrays;
- mesh topology arrays and invalid triangle/edge/hull indices;
- missing or invalid bind coordinates and weight values/sums;
- deform setup and deform key offset counts;
- clip track map/key structure, references, times, interpolation curves, events, active clip, and ToonDoc camera/layer data.

Warnings do not block JSON export. Weight sums above `1.0` (with a `0.000001` tolerance for six-decimal rounding), broken references, malformed tracks, invalid topology, and missing required setup data are errors and mean the payload is not valid v11 runtime data. Per-vertex sums from `0.0` through `1.0` are accepted; the remaining weight is implicit rest/local-space influence.

## Migration from v10.x editor data

V11 runtime export is generated from the current editor state:

```text
v10.x project/editor data → importData() → current editor state → buildRuntimeDocument() → v11 runtime JSON
```

Important migration rules:

- editor-only fields are dropped;
- `slot.mesh` is moved to top-level `meshes[]`;
- `slot.setupLocal` becomes `slot.setup` and `setupPose.slots[id]`;
- `bone.rest` becomes `bone.rest` and `setupPose.bones[id]`;
- vertex weights are normalized into `{ bone, w, bind }` records;
- partial weight sums are preserved and marked by `weightSumPolicy`.
