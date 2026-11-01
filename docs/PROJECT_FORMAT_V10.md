# Project Format v10 / v10.20 — Historical Editor Notes

Current prototype family:

```text
indie-2d-v10-doc-types-v10.20-export-cleanup-prep
```

This document describes the historical v10 developer-facing JSON model used by the browser prototype. It is not the locked runtime format. The stable runtime schema is documented in `PROJECT_FORMAT_V11.md`.

## Root object

```json
{
  "version": "indie-2d-v10-doc-types-v10.20-export-cleanup-prep",
  "documentType": "game",
  "projectName": "Untitled",
  "objects": [],
  "bones": [],
  "slots": [],
  "attachments": [],
  "markers": [],
  "poses": [],
  "animation": {},
  "animations": [],
  "activeAnimationId": "clip1",
  "editor": {}
}
```

`documentType` can be:

```text
game   GameDoc
toon   ToonDoc
none   startup state before a document is created
```

## Objects

```json
{
  "id": "obj1",
  "name": "Character",
  "root": "b1",
  "parentSlot": null,
  "visible": true,
  "renderLayerId": "chars"
}
```

Objects group bones and slots. An object can be nested inside another object's slot.

## Bones

```json
{
  "id": "b1",
  "name": "upper_arm_L",
  "parent": "root",
  "objectId": "obj1",
  "objectRoot": false,
  "isRoot": false,
  "connected": true,
  "role": "deform",
  "affectWeights": true,
  "rest":  { "x": 0, "y": 0, "r": 0, "len": 80, "sx": 1, "sy": 1 },
  "local": { "x": 0, "y": 0, "r": 0, "len": 80, "sx": 1, "sy": 1 },
  "width": 12,
  "color": "#4ea1ff",
  "shape": "bone"
}
```

The locked project root has id `root` and should not be treated as a normal deform bone.

## Attachments

```json
{
  "id": "a1",
  "name": "forearm.png",
  "type": "image",
  "w": 256,
  "h": 128,
  "naturalW": 256,
  "naturalH": 128,
  "pivotX": 0.5,
  "pivotY": 0.5,
  "src": "data:image/png;base64,..."
}
```

Folder save/load can write PNG files to `assets/` instead of embedding data URLs.

## Slots

```json
{
  "id": "s1",
  "name": "forearm_art",
  "bone": "b1",
  "parentBone": "b1",
  "objectId": "obj1",
  "attachment": "a1",
  "visible": true,
  "alpha": 1,
  "tint": "#ffffff",
  "tintAlpha": 0,
  "blendMode": "normal",
  "local": { "x": 0, "y": 0, "r": 0, "sx": 1, "sy": 1 },
  "mesh": {},
  "pose": {}
}
```

`bone` / `parentBone` is the rigid slot parent. Mesh weights are separate and optional.

## Mesh v3

```json
{
  "enabled": true,
  "version": 3,
  "vertices": [
    {
      "x": -64,
      "y": -32,
      "u": 0,
      "v": 0,
      "weights": [
        { "bone": "b1", "w": 1, "x": 12.4, "y": -3.2 }
      ]
    }
  ],
  "triangles": [[0, 1, 2]],
  "edges": [[0, 1], [1, 2], [0, 2]],
  "hull": [0, 1, 2],
  "selected": [],
  "gridCols": 1,
  "gridRows": 1,
  "dirtyTopology": false,
  "bindPoseVersion": 1
}
```

### Runtime-critical fields

```text
vertices
triangles
weights
u/v
x/y
```

### Editor-derived fields

```text
edges
hull
selected
gridCols/gridRows
dirtyTopology
bindPoseVersion
```

Exporters should call `ensureMeshTopology()` before writing files.

## Vertex weights

```json
{ "bone": "b1", "w": 0.75, "x": 8.5, "y": -2.0 }
```

`x/y` are bind coordinates in the target bone's local basis.

Sampling rule:

```text
weightedWorldVertex = sum(worldPointFromBoneLocal(weight.x, weight.y) * weight.w)
```

Weights should be normalized per vertex. Prune tiny influences and respect the editor's `maxInfluences` value.

## Deform pose and deform tracks

Current pose offset:

```json
{
  "deform": {
    "offsets": [
      { "x": 0, "y": 0 },
      { "x": 2, "y": -3 }
    ]
  }
}
```

Animation keys:

```json
{
  "deformTracks": {
    "s1": [
      {
        "t": 0.5,
        "offsets": [
          { "x": 0, "y": 0 },
          { "x": 2, "y": -3 }
        ],
        "curve": { "type": "smooth" }
      }
    ]
  }
}
```

Offset count should always match `mesh.vertices.length`.

## Clips

```json
{
  "id": "clip1",
  "name": "walk",
  "duration": 1.2,
  "fps": 24,
  "boneTracks": {},
  "slotTracks": {},
  "deformTracks": {},
  "cameraTracks": {},
  "events": []
}
```

## ToonDoc extension

```json
{
  "toon": {
    "canvas": {
      "width": 1920,
      "height": 1080,
      "background": "#000000",
      "transparent": true
    },
    "cameras": [
      { "id": "cam1", "name": "Main Camera", "x": 0, "y": 0, "r": 0, "z": 1 }
    ],
    "activeCameraId": "cam1",
    "renderLayers": [
      { "id": "chars", "name": "Characters", "order": 10, "visible": true, "locked": false }
    ]
  }
}
```

## Editor block

Editor-only state lives in `editor`:

```json
{
  "projectRootId": "root",
  "view": {},
  "pick": {},
  "onion": {},
  "timeline": {},
  "layout": {
    "leftW": 300,
    "assetW": 300,
    "rightW": 356,
    "timelineH": 260,
    "timelineLeftW": 300,
    "timelineRightW": 356,
    "meshWorkbenchH": 420
  },
  "art": {},
  "outliner": {},
  "inspectorTab": "transform",
  "meshEdit": {
    "enabled": false,
    "workbenchTab": "binding",
    "selectionMode": "vertex",
    "actionTool": "select",
    "showWeights": true,
    "maxInfluences": 4
  }
}
```

The current prototype exports some editor data with runtime data. `layout.meshWorkbenchH` stores the resizable lower viewport workbench height. A production exporter should split editor UI state from runtime data.


## v10.5 editor notes

`mesh.version` remains `3`. v10.5 does not change runtime mesh data. It adds editor workflow around selection and cleanup: box selection for vertices/edges/triangles, context-aware all/invert selection, and loose vertex cleanup that keeps deform offset arrays aligned with mesh vertex indices.


## v10.6 editor behavior notes

Knife Tool v2 does not change the serialized mesh schema. It adds editor behavior for producing the same stable topology data:

- drag-line cuts insert new vertices on crossed triangle edges;
- adjacent triangles share the same inserted vertex for the same crossed edge;
- inserted vertices interpolate `x/y`, `u/v`, weights and deform offsets;
- resulting topology is still stored as `vertices`, `triangles`, `edges`, and `hull`.


## v10.7 editor behavior notes

Weight Paint UX does not change the runtime mesh schema. It adds editor behavior around existing vertex weights:

- `editor.meshEdit.weightTool` stores `paint` or `select`.
- `editor.meshEdit.weightBrushMode` stores `add`, `subtract`, `smooth`, or `replace`.
- `editor.meshEdit.weightBrushSize` stores the brush radius in screen pixels.
- `editor.meshEdit.weightBrushStrength` stores brush opacity/strength from `0..1`.
- `editor.meshEdit.weightBrushValue` stores the target value used by Replace mode.
- `editor.meshEdit.weightBrushSelectedOnly` restricts brush edits to selected vertices when enabled.

Brush strokes still write the same runtime-safe vertex data:

```json
{ "bone": "bone_1", "w": 0.75, "x": 12.0, "y": -3.5 }
```

After each stroke, edited vertices are normalized, pruned by `maxInfluences`, and rebound so stored local bind coordinates remain consistent.


## v10.9 editor behavior notes

v10.9 does not change the runtime mesh schema. It changes editor-only Weight Paint behavior:

- Weight Paint is an explicit modal session: Start Paint → strokes → Apply or Cancel.
- The temporary session snapshot is editor-only and is not exported as runtime data.
- `Cancel` restores the mesh weights from the session snapshot.
- `Apply` clears the session and returns the viewport to normal rigging/mesh interaction.
- During an active paint session, bone/slot clicks do not steal viewport focus.

v10.8 layout state remains editor-only:

- View / Pick Filters are editor controls stored under `editor.view` and `editor.pick`.
- Lower workbench height remains stored in `editor.layout.meshWorkbenchH`.
- The collapsible side panel is stored in `editor.layout.viewFiltersCollapsed` and `editor.layout.viewFiltersW`.
- Assets / Markers are displayed in the lower rigging workbench, but serialize as the same `attachments[]` and `markers[]` arrays.


## v10.10 editor behavior notes

v10.10 does not change the runtime mesh schema. It extends editor-only weight UX with a modal **Weight Adjust** session. The editor stores `meshEdit.weightAdjustSensitivity` as an editor preference; project/runtime meshes still use the same vertex `weights` arrays.


## v10.11 editor behavior notes

v10.11 does not change runtime mesh data. It adds an editor-only visualization preference: selected/active-bone vertex weights are rendered as filled circular gauges rather than alpha-only dots. The underlying `vertices[].weights[]` arrays are unchanged.


## v10.12 editor behavior notes

The runtime object shape is unchanged, but editor weight semantics were clarified for single-influence vertices. If a vertex has only the active bone and the user lowers that weight below 1.0, the remaining amount is treated as implicit rest/unassigned influence rather than being normalized back to 100%. If other bone influences exist, the other influences share `1 - activeWeight` and the total remains normalized to 1.0.

This keeps the filled vertex gauge honest: a 65% gauge means the stored active-bone influence is 0.65, even when no second bone has been assigned yet.


## v10.15 Setup Pose Guard additions

Slots may now contain `setupLocal`, a transform object with `{ x, y, r, sx, sy }`. `local` remains the current viewport/evaluated transform, while `setupLocal` is the rigging/setup baseline used before slot animation keys are sampled. Bones keep the existing `rest` versus `local` split.

The editor settings may contain `editor.rig` with setup-pose metadata such as `setupPoseVersion`, `protectSetupInAnimation`, and `bindPoseLastSetAt`.


## v10.16 Deformation Preview / Test Pose additions

No runtime data schema changed in v10.16. Test Pose is an editor-only preview session stored transiently in `state.rig.testPose` and is not exported as runtime animation data. During Test Pose, bone `local` transforms may change temporarily, but `rest`, `slot.setupLocal`, mesh topology, weights, and animation keyframes are not written.



## v10.19 Weight Mirror / Symmetry Tools

No runtime mesh schema changed in v10.19. Weight Mirror is an editor tool that copies existing `vertices[].weights[]` data to mirrored destination vertices and then rebuilds the destination bind coordinates.

Editor-only settings may include:

```json
{
  "editor": {
    "meshEdit": {
      "weightMirrorAxis": "slot",
      "weightMirrorDirection": "selected"
    }
  }
}
```

Supported `weightMirrorAxis` values:

- `slot` — mirror around local slot X = 0.
- `bounds` — mirror around the current mesh bounds center.
- `object` — mirror around the active object root X axis projected into slot local space.

Supported `weightMirrorDirection` values:

- `selected` — mirror selected source vertices to their opposite-side vertices.
- `lr` — copy left-side vertices to right-side vertices.
- `rl` — copy right-side vertices to left-side vertices.

Bone influences are remapped by common naming conventions: `_L/_R`, `.L/.R`, `-L/-R`, `L_/R_`, and `left/right`. If a mirrored bone is not found, the original influence is kept and the preview reports the missing pair.


## Runtime export prep

v10.20 introduced a staging export. The stable runtime schema is now documented in `PROJECT_FORMAT_V11.md`.

### Full project save

`exportData()` is still the editor/project save payload. It intentionally contains editor state such as layout, selections, view filters, workbench tabs, brush settings, diagnostics preferences, and other UI-only data.

### Runtime preview

`buildRuntimeDocument()` creates a cleaned payload with only runtime-relevant data:

```text
objects
bones with rest/setup transforms
slots with setupLocal transforms
attachments
mesh vertices / uvs / triangles / edges / hull
vertex weights with bind coordinates
current deform offsets
animations / bone tracks / slot tracks / deform tracks / events
markers
optional ToonDoc settings
```

The runtime preview excludes editor-only data:

```text
editor
layout
view / pick filters
selection / hover state
brush sessions
weight paint / adjust sessions
diagnostics UI state
test pose state
undo / redo
workbench tab state
```

`validateRuntimeDocument()` checks the generated payload before the v11 schema freeze. It reports missing bones, invalid triangle indices, unweighted enabled mesh vertices, missing bind coordinates, bad slot attachments, and stale deform tracks.
