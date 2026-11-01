# Indie 2D Skeletal Editor · v11 Stable Runtime Export

Indie 2D Skeletal Editor is a vanilla JavaScript prototype for 2D skeletal animation, mesh deformation, vertex weights, FFD keys, scene objects, and ToonDoc PNG rendering.

The current build is a **developer prototype** with a frozen **runtime export schema v11**. The editor save file still keeps UI/workbench state, but the Runtime JSON panel now emits a clean game/runtime payload intended for a future Haxe/Kha runtime or another engine integration.

## Current status

```text
Status:        prototype / MVP
Runtime:       browser, Canvas 2D, vanilla JavaScript
Documents:     GameDoc, ToonDoc
Persistence:   project JSON, embedded image data URLs, optional folder save/load
Mesh format:   mesh.version = 3
Runtime export: indie-2d-runtime-v11 / schemaVersion 11.0.0
Primary focus: rigging, mesh topology, weights, FFD deform keys, stable runtime JSON
```

v11 keeps the completed mesh/binding/weights workflow from the v10.x line and freezes a runtime-oriented export layer.

Implemented editor workflow:

- every slot mesh is normalized to `mesh.version = 3`;
- meshes maintain `vertices[]`, `triangles[]`, derived `edges[]`, and `hull[]`;
- the Mesh Workbench has explicit **Vertex / Edge / Triangle** selection modes;
- viewport hit-testing can pick vertices, edges, and triangles directly;
- box select works for vertices, edges, and triangles, with **Shift** to add and **Ctrl/Cmd** to toggle;
- topology tools include **Split Edge**, **Collapse Edge**, **Swap / Flip Edge**, **Weld Vertices**, **Delete Selected Element**, **Clean Loose Verts**, **Rebuild Edges/Hull**, and **Select Hull**;
- Knife v2 supports both quick point cuts and drag-line cuts through multiple triangles;
- topology edits preserve UVs, interpolate vertex weights, and keep FFD offset arrays aligned with vertex indices;
- the Weights tab has brush modes **Add**, **Subtract**, **Smooth**, and **Replace**;
- Weight Paint and Weight Adjust are explicit modal sessions with **Apply / Cancel**;
- Weight overlay uses filled vertex gauges and supports active-bone and multi-influence views;
- Binding has **Workflow** and **Advanced / diagnostics** sub-tabs;
- Setup/Bind Pose, Deformation Test Pose, Deformation Diagnostics, and Mirror/Symmetry tools are available in the lower workbench.

Runtime export v11:

- `buildRuntimeDocument()` now emits `format: "indie-2d-runtime"`, `schema: "indie-2d-runtime-v11"`, `version: 11`, `schemaVersion: "11.0.0"`;
- runtime data separates `slots[]` from `meshes[]`; slots reference meshes by id;
- runtime data includes explicit `setupPose.bones` and `setupPose.slots`;
- mesh vertices, UVs, triangles, edges, hull, per-vertex weights, bind coordinates, and optional deform setup are exported in a stable schema;
- `validateRuntimeDocument()` validates schema version, references, parallel weights, topology indices, bind coordinates, setup pose entries, and deform-track offsets;
- Data / Export contains **Project JSON** for full editor saves and **Runtime JSON v11** for clean game/runtime payloads;
- Runtime JSON excludes editor-only state such as layout, selection, hover, brush sessions, diagnostics UI state, test-pose state, undo/redo, view filters, pick filters, and workbench tabs;
- a **Download Runtime v11** button exports the runtime payload as a standalone JSON file.

## Running the editor

Run from a local server instead of directly opening `index.html`, especially when using folder save/load.

```bash
cd indie_2d
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Folder save/load uses the browser File System Access API, so Chromium-based browsers are the best supported target.

## Project layout

```text
indie_2d/
├─ index.html                  main editor shell
├─ css/editor.css              editor layout and panels
├─ js/
│  ├─ state.js                 shared editor state and DOM handles
│  ├─ model.js                 scene graph, bones, slots, mesh, weights, topology helpers
│  ├─ canvas-renderer.js       Canvas 2D rendering, mesh drawing, viewport overlays
│  ├─ hit-testing.js           viewport picking
│  ├─ transform-gizmo.js       selection transform gizmos, vertex transform gizmo
│  ├─ input.js                 pointer/keyboard/tool wiring
│  ├─ panels.js                inspector, outliner, document panels, mesh workbench
│  ├─ timeline.js              dope sheet UI
│  ├─ animation-curves.js      keys, interpolation, FFD sampling
│  ├─ elastic-bones.js         elastic preview and smart bake
│  ├─ commands.js              project commands, validation, cleanup
│  ├─ persistence.js           import/export/autosave/folder save-load
│  ├─ doc-types.js             GameDoc / ToonDoc creation and migration
│  ├─ render-export.js         ToonDoc PNG render export
│  ├─ layout.js                resizable panel layout
│  └─ main.js                  startup wiring
├─ ROADMAP.md                   implementation roadmap and release status
├─ docs/
│  ├─ PROJECT_FORMAT_V11.md     stable runtime export schema
│  ├─ PROJECT_FORMAT_V10.md     editor/project format notes
│  ├─ MESH_WEIGHTS_RESEARCH.md
│  ├─ MESH_WEIGHTS_ROADMAP.md
│  ├─ ARCHITECTURE_NOTES.md
│  ├─ PROJECT_FORMAT_V8.md     old historical format notes
│  └─ HAXE_KHA_PORTING_PLAN.md
└─ CHANGELOG.md
```

## Architecture overview

The prototype uses shared global state rather than modules/classes. This is acceptable for the JS prototype, but a native rewrite should split the model, editor commands, viewport, animation sampler, and exporters into explicit systems.

Core flow:

```text
state.js
  ↓
model.js                  scene/bone/slot/mesh mutation helpers
  ↓
canvas-renderer.js         visual representation of current model state
  ↓
input.js + panels.js       tools and UI actions mutate model helpers
  ↓
animation-curves.js        evaluates keys and FFD tracks over time
  ↓
persistence.js             serializes the current project JSON
```

The safest rule for new features is: **mutate data through `model.js` helpers, then call `changed()` and `renderAll()` from UI/commands**.

## Document types

### GameDoc

GameDoc is the game/runtime-oriented document type. It contains:

- objects;
- bones;
- slots/artwork;
- mesh topology;
- vertex weights;
- FFD deform tracks;
- animation clips;
- events, markers, sockets, hitboxes.

### ToonDoc

ToonDoc extends GameDoc with rendering-oriented data:

- canvas width/height/background;
- active camera and camera tracks;
- render layers/passes;
- PNG current-frame or sequence export.

GameDoc should stay runtime-friendly. ToonDoc can later support heavier render-only features.

## Core data model

### Bones

Bones store rest/setup transforms and current local transforms:

```json
{
  "id": "b1",
  "name": "upper_arm_L",
  "parent": "root",
  "role": "deform",
  "affectWeights": true,
  "rest":  { "x": 0, "y": 0, "r": 0, "len": 80, "sx": 1, "sy": 1 },
  "local": { "x": 0, "y": 0, "r": 0, "len": 80, "sx": 1, "sy": 1 }
}
```

Bone roles:

```text
root      locked project/object root
deform    participates in auto-bind and vertex weights
control   animator control, ignored by auto-bind
socket    attachment/control marker, ignored by auto-bind
```

### Slots

A slot owns artwork placement and optional mesh deformation data.

```json
{
  "id": "s1",
  "name": "forearm_art",
  "bone": "b1",
  "attachment": "a1",
  "local": { "x": 0, "y": 0, "r": 0, "sx": 1, "sy": 1 },
  "mesh": {},
  "deform": { "offsets": [] }
}
```

The slot parent bone controls the rigid slot transform. Mesh vertex weights are optional and only needed for bending/deformation.

### Mesh v3

```json
{
  "version": 3,
  "enabled": true,
  "vertices": [
    {
      "x": -50,
      "y": -50,
      "u": 0,
      "v": 0,
      "weights": [
        { "bone": "b1", "w": 1, "x": 12.4, "y": -3.2 }
      ]
    }
  ],
  "triangles": [[0, 1, 2], [0, 2, 3]],
  "edges": [[0, 1], [1, 2], [0, 2], [2, 3], [0, 3]],
  "hull": [0, 1, 2, 3],
  "selected": [],
  "gridCols": 1,
  "gridRows": 1,
  "dirtyTopology": false,
  "bindPoseVersion": 1
}
```

`edges[]` and `hull[]` are editor-facing derived data. They are rebuilt from `triangles[]` by `ensureMeshTopology()` and are useful for tools, selection, validation, and future exporters.

### Vertex weights

Each vertex can have zero or more bone influences.

```json
{ "bone": "b2", "w": 0.65, "x": 10.2, "y": -4.1 }
```

Meaning:

```text
bone  bone id
w     normalized influence weight
x/y   vertex bind position in that bone's local coordinates
```

If a vertex has no weights, it falls back to the slot transform. A weighted vertex is sampled by transforming each bone-local bind point to world space and blending by normalized weight.

### FFD deform offsets

Rigging mesh edits change setup topology. Animation deform edits write per-vertex offsets:

```json
{
  "deformTracks": {
    "s1": [
      { "t": 0.0, "offsets": [{ "x": 0, "y": 0 }] },
      { "t": 0.5, "offsets": [{ "x": 4, "y": -8 }] }
    ]
  }
}
```

Topology operations keep these arrays aligned:

```text
Split Edge      inserts one averaged offset
Collapse Edge   removes one offset and averages into the kept vertex
Swap Edge       preserves vertex indices, so offsets are unchanged
```

## Editor workflow

### Rigging Mode

Use Rigging Mode for setup data:

1. Import or place artwork.
2. Create bones.
3. Open Mesh Workbench → Binding and set Parent Bone.
4. Use Mesh Workbench → Mesh to create/edit topology.
5. Use Mesh Workbench → Weights to bind vertices.
6. Validate project health.

### Animation Mode

Use Animation Mode for runtime/clip data:

1. Pose bones.
2. Key bone and slot properties.
3. Use Slot → Deform for FFD vertex offsets in Animation mode.
4. Edit keys in the grouped dope sheet.
5. Export project JSON or ToonDoc PNG frames.

## Mesh editing tools

The **Mesh Workbench → Mesh** tab contains setup topology tools below the viewport.

### Grid cutter

The grid cutter is still the fastest way to create a predictable mesh:

```text
Quad
Grid 2×2
Grid 3×3
Grid 4×4
Apply grid
+ vertical cut
+ horizontal cut
```

Rebuilding a grid replaces topology. Use it early, before detailed FFD animation.

### Element selection modes

The lower viewport workbench is a horizontal, resizable panel. Its left half contains View and Pick Filters. Its right half contains Binding, Mesh and Weights. The Mesh tab separates the editor context from the selected mesh element type:

```text
1 / Vertex   select and move vertices
2 / Edge     select edges directly by clicking the edge segment
3 / Triangle select triangles by clicking inside them
K / Knife    click for point cut, or drag a line through several triangles
P / Paint    start/apply Weight Paint session in the Weights tab
[ / ]        decrease / increase weight brush size
```

Edge and triangle selections are also mirrored into `selectedVerts[]` so they can be transformed as vertex groups. This keeps the UX direct while preserving the runtime mesh as a triangle mesh.

### Topology tools

```text
Split Edge              add a vertex on the selected edge and split adjacent triangles
Collapse Edge           merge the selected edge into one vertex
Swap / Flip Edge        flip the shared diagonal between two triangles
Weld Selected Verts     merge selected vertices into one averaged vertex
Delete Selected Element delete selected vertices, edges, or triangles based on selection mode
Select Hull             select boundary vertices
Rebuild Edges/Hull      regenerate derived topology data
```

Knife and topology operations preserve UVs, interpolate vertex weights, and update FFD offset arrays. Knife v2 can reuse shared edge insertions across adjacent triangles during a drag-line cut. The UX borrows from Blender-style element selection and Knife, OpenToonz Plastic-style edge operations, and Godot-style separation between mesh setup and weight editing.

## Weight editing tools

The **Mesh Workbench → Weights** tab contains vertex influence tools:

```text
Set 100% to bone
Blend +50%
Remove bone weight
Normalize weights
Limit influences
Smooth selected weights
Auto bind object bones
Auto Bind Selected Bones
Fast bind top/bottom/left/right/all regions
```

Weight visualization shows the active bone's influence. Unweighted vertices are marked with a red X.

Weight Paint v10.7 adds viewport brush editing:

```text
Start Paint / Apply / Cancel session
Add / Subtract / Smooth / Replace brush modes
Brush size and strength
Replace target value
Selected-vertices-only painting
Live brush circle and active-bone heatmap hit highlighting
```

Current limitation: Weight Paint v1 paints per-vertex influence inside a circular screen-space brush. It does not yet paint continuous texture-space areas between vertices or support locked weights.

## Animation system

Clips live in `animations[]`. The active clip is also assigned to `state.anim`.

Track types:

```text
boneTracks     transform keys for bones
slotTracks     slot transform, attachment, visibility, alpha, tint, blend mode
cameraTracks   ToonDoc camera keys
deformTracks   FFD per-slot vertex offset keys
events         timeline event markers
```

Interpolation supports smooth/linear/hold/bezier/hermite depending on the key type and curve metadata.

## Import/export

### JSON export

The JSON panel exports the full current project, including editor metadata. For a production runtime, split this into:

```text
project.json or rig.json       runtime-safe data
editor.json                    UI layout, selected item, debug flags
assets/                        external PNG files
animations/*.json              optional clip split
```

### Folder save/load

Folder save/load writes `project.json` and an `assets/` directory when the browser supports the File System Access API.

### PNG export

ToonDoc can render the current frame or animation sequence to PNG using the active Toon camera and render layers.

## Known limitations

- Global state and function declarations are prototype-friendly but not scalable.
- Mesh topology operations are triangle-based and local; there is no full polygon/alpha auto-mesher yet.
- Weight Paint and Weight Adjust are implemented as modal sessions; continuous texture-space painting between vertices is not implemented yet.
- Mesh deletion and complex hole/cut workflows are not implemented.
- `edges[]` and `hull[]` are derived from triangle topology; v11 runtime export validates them but runtime loaders may also rebuild them if desired.
- Folder save/load depends on Chromium-style File System Access APIs.
- Some older documentation is kept for history and may use v8/v9 labels.

## Development direction

Current next priority:

```text
1. Build a minimal Runtime Viewer / Smoke Test for Runtime JSON v11.
2. Load exported v11 JSON outside the editor.
3. Draw skeleton + slots + weighted meshes.
4. Sample one animation clip and deform tracks.
5. Keep alpha-outline / auto-mesh generation as a later editor feature.
```

Reference docs:

- `docs/MESH_WEIGHTS_RESEARCH.md`
- `docs/MESH_WEIGHTS_ROADMAP.md`
- `docs/PROJECT_FORMAT_V11.md`
- `docs/PROJECT_FORMAT_V10.md`


## v10.11 Weight Gauge Notes

The Weights tab no longer relies on alpha-only circles. When an active bone is selected, every vertex is drawn as a small circular gauge. The filled slice represents that bone's normalized influence on the vertex. Selected, hovered, and brushed vertices also show a numeric percentage label inside the circle. If no active bone is available, the editor falls back to multi-influence pies using bone colors.

This follows the same readability goal as Spine's Weights view, where vertex pies show per-bone weight slices, while keeping the current Indie 2D workflow focused on the active bone during Paint and Adjust sessions.


## v10.16 Deformation Preview Notes

v10.16 does not change the runtime mesh deformation schema, but it makes the setup/animation split explicit. The Binding workbench still follows the common rigging path:

1. **Parent slot** — choose selected/nearest parent bone or keep the slot rigid.
2. **Create mesh topology** — build a 3×3 or 4×4 mesh and jump to Mesh editing.
3. **Bind / auto-weight** — bind against object bones or the parent chain and jump to Weights.
4. **Test deformation** — exit mesh edit and select the parent/active bone for manual deformation checks.

The Binding tab also exposes **Quick rigid** and **Quick mesh setup**. Quick rigid keeps the artwork as a rigid child of a bone. Quick mesh setup creates a 3×3 mesh, auto-binds it to available object bones, enables weight gauges, and opens the Weights tab. The new setup controls let the developer explicitly commit the current rigging pose as the bind pose or restore it before continuing setup work.

The v10.16 **Test Pose** controls are separate from Animation mode. Start Test Pose restores setup first, then lets you drag bones in the viewport only as a deformation preview. Reset returns to setup while staying in Test Pose; Exit restores setup and closes the preview. These moves do not write keys and do not modify `bone.rest`, `slot.setupLocal`, mesh topology, or weights.

## v10.12 Weight Adjust Fix Notes

v10.12 fixes the sticky 100% weight gauge bug. Previously, if a vertex had only one influence and that influence reached 100%, lowering the active bone's weight could appear stuck at 100% until the value hit 0%. The cause was automatic normalization: with no other bone to receive the remainder, the single influence was normalized back to 1.0.

The editor now preserves partial single-bone weights during Paint/Adjust sessions. The unfilled part of the vertex gauge represents implicit rest/unassigned influence. Runtime deformation blends that remainder against the setup vertex position, while vertices with two or more bone influences still normalize the remaining weight across the other bones.


## Setup / Bind Pose Guard

Version v10.16 separates rig setup data from animation pose data more explicitly. Bones use `rest` as the setup transform and `local` as the current editable/evaluated transform. Slots now also store `setupLocal`, so animation sampling can reset slots to a stable setup transform before applying slot keys.

In the Binding workbench, use **Set Bind Pose** after arranging bones/slots and weights. This copies the current rigging pose into setup data and rebinds mesh weights to the current bone transforms. Use **Restore Bind Pose** before continuing rig edits if the viewport has been left in an animated/test pose. Switching from Animation mode back to Rigging mode restores the setup pose automatically.


## v10.19 Weight Mirror Notes

v10.19 adds editor-only weight mirror tools to speed up symmetrical character setup. The underlying runtime mesh schema is unchanged: the tools copy `vertices[].weights[]` between paired mesh vertices and rebuild bind coordinates for the destination vertices.

The viewport can show warning markers directly on problem vertices:

- red `!` = unweighted vertex;
- orange `+` = too many influences;
- pink `?` = missing bone reference;
- yellow `B` = missing bind coordinates;
- purple `>` = total weight above 100%.

The safe fixes are intentionally conservative: auto-weight only unweighted vertices, prune/clean invalid influences, rebuild bind coordinates from the current setup pose, and resize deform offset arrays to match the mesh vertex count.


### Weight Mirror / Symmetry

The Weights workbench includes a **Mirror / symmetry** card:

- **Selected → opposite** copies selected source vertices to their nearest mirrored vertices.
- **Left → Right** copies all vertices on the local left side of the axis to the right side.
- **Right → Left** copies all vertices on the local right side of the axis to the left side.
- Axis modes are **Slot center X**, **Mesh bounds center**, and **Object root X**.
- Bone names are remapped by common side-name conventions: `_L/_R`, `.L/.R`, `-L/-R`, `L_/R_`, and `left/right`.
- If a mirrored bone is missing, the tool keeps the original bone influence and reports the missing pair in the preview instead of silently dropping the weight.
