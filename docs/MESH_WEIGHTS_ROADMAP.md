# Mesh & Weight Editing Roadmap

## Phase 1 — Mesh schema stabilization

Status: implemented in v10.1 and extended through v11.

- Normalize all slot meshes to `mesh.version = 3`.
- Keep `vertices[]`, `triangles[]`, `edges[]`, `hull[]`.
- Rebuild derived topology on import/export.
- Validate invalid triangles, loose vertices, missing topology.

## Phase 2 — Local topology editing

Status: direct mesh editor UX implemented in v10.2; viewport Mesh Workbench added in v10.3; resizable horizontal workbench layout added in v10.4; selection polish added in v10.5; Knife v2 added in v10.6.

Implemented:

- Explicit Vertex / Edge / Triangle selection modes.
- Direct edge hit-testing in the viewport.
- Direct triangle hit-testing in the viewport.
- Split selected edge.
- Collapse selected edge.
- Swap / flip selected edge shared by two triangles.
- Knife v1: split clicked edge at cursor position.
- Knife v1: insert a vertex into a clicked triangle.
- Weld selected vertices.
- Delete selected vertices, selected edges, or selected triangles.
- Select hull vertices.
- Rebuild edges/hull.

v10.3 additions:

- Binding, Mesh and Weights moved from the Inspector to a bottom viewport workbench.
- Selected edges and triangles use the same transform gizmo as vertices.
- UI wording changed from Face/Polygon to Triangle for the current triangle runtime.

v10.4 additions:

- Lower viewport workbench is resizable by height.
- Default lower workbench height is increased to 420px.
- Workbench is split horizontally: View / Pick Filters on the left, Binding / Mesh / Weights on the right.
- View and Pick Filters are removed from the right Inspector.

v10.5 additions:

- Box select works for vertices, edges, and triangles.
- Shift adds to mesh box selection; Ctrl/Cmd toggles mesh box selection.
- Edge box selection uses segment/rectangle intersection.
- Triangle box selection uses triangle/rectangle intersection.
- Selection counters are visible in the Mesh Workbench.
- Context-aware All and Invert selection actions are available for vertex, edge, and triangle modes.
- Clean Loose Verts removes vertices not referenced by any triangle while preserving deform offset index alignment.

v10.6 additions:

- Knife drag-line cuts across multiple triangles in one gesture.
- Knife preview line is shown while dragging.
- Shared-edge cut vertices are reused across adjacent triangles.
- Knife inserts interpolate UVs, vertex weights, and FFD offsets.

Next improvements:

- Multi-segment click-path Knife with confirm/cancel.
- Better local retriangulation after vertex deletion.
- Cut Mesh / duplicate boundary edge for separable folds and holes.
- Edge-loop / boundary-loop selection helpers.

## Phase 3 — Weight editing UX

Status: brush-based Weight Paint UX implemented in v10.7 and made modal with Apply/Cancel in v10.10.

Implemented:

- Select vertices.
- Choose active bone.
- Bind selected vertices.
- Add/remove influences.
- Normalize, prune, smooth.
- Auto-bind object bones or selected chain.
- Show active bone heatmap.
- Explicit Start Paint / Apply / Cancel session in the Weights tab.
- Viewport brush circle overlay.
- Brush settings: size, strength, replace target value.
- Brush modes: Add, Subtract, Smooth, Replace.
- Optional selected-vertices-only brush painting.
- Per-stroke normalization/pruning.
- Cancel restores pre-session weights from a temporary mesh snapshot.
- Per-vertex influence summary for selected vertices.

Next:

- Add locked weights per bone/influence.
- Add mirror weights across object-root X axis.
- Add copy/paste weights between selected vertices.
- Add continuous multi-bone smoothing / blur mode.

## Phase 4 — Bind pose and topology safety

- Add explicit bind-pose refresh command.
- Warn before grid rebuild when deform keys already exist.
- Warn when deform key offset counts do not match mesh vertex count.
- Add repair command for deformTracks offset arrays.
- Add `maxInfluences` validation per vertex.

## Phase 5 — Auto mesh

- Generate outline from attachment alpha.
- Simplify outline points.
- Add internal vertices near expected bend zones.
- Triangulate polygon.
- Rebuild UV from local vertex positions.
- Optional grid fallback for simple sprites.

## Phase 6 — Runtime export split

- Split editor-only data from runtime data.
- Decide whether `edges[]`/`hull[]` stay in runtime export or editor export only.
- Export animations as separate files.
- Keep data compatible with a future Haxe/Kha runtime.

## Phase 7 — Advanced deformation

- Mesh groups.
- Per-slot masks/clipping.
- Constraints.
- IK targets as first-class animatable objects.
- Animation layers and blending.
- ToonDoc-only raster/render deformation experiments.


## v10.10 Weight Adjust Session

Status: implemented. Selected vertices can now be adjusted by mouse drag for the active bone: right/up increases weight, left/down decreases weight, Shift gives finer control, and Apply/Cancel commits or restores the snapshot.


## v10.11 Weight Gauges

Status: implemented.

- Replace alpha-only weight circles with filled active-bone gauges.
- Show numeric percent labels on selected / hovered / brushed vertices.
- Fall back to multi-influence pies when no active bone is selected.
- Keep runtime mesh schema unchanged.


## v10.12 Weight Adjust Fix

Status: implemented.

- Fixed sticky 100% active-bone gauges.
- Preserved partial single-bone weights for Paint/Adjust sessions.
- Treated the missing remainder as implicit rest/unassigned influence for viewport deformation.
- Left multi-influence vertices normalized when other bones are available.



## v10.13 Weight Panel Cleanup

Status: implemented.

- Vertex Selection moved left in the Weights workbench.
- Brush controls moved right, near the viewport paint/adjust session controls.
- Auto / Region Bind no longer shows the raw per-vertex debug weight list.
- Selected-vertex details remain available through the Selected Vertex Influences card and viewport gauges.


## v10.14 Binding Workflow

Status: implemented.

- Added guided Binding workflow: Parent Slot → Create Mesh Topology → Bind / Auto-Weight → Test Deformation.
- Added per-step status cards and clear diagnostics for missing parent, disabled mesh render, missing influences, and unweighted vertices.
- Added Quick rigid and Quick mesh setup actions.
- Added shortcuts into Mesh and Weights tabs, plus test-selection buttons for parent/active bones.
- Kept manual parent and bind controls available under the guided workflow.

## v10.15 Setup Pose Guard

Status: implemented.

- Added Set Bind Pose, Restore Bind Pose, Rebind weights, and Animate test actions.
- Added `slot.setupLocal` as the slot setup baseline.
- Animation sampling resets from setup data before applying keys.
- Returning from Animation mode to Rigging restores setup/bind pose.

## v10.18 Deformation Preview / Test Pose

Status: implemented.

- Added temporary Test Pose mode.
- Dragging bones in Test Pose previews mesh deformation only.
- Test Pose does not write animation keys, setup pose, bind pose, mesh topology, or weight data.
- Reset restores setup pose while keeping the preview mode active; Exit restores setup and closes the mode.



## v10.18 Binding Layout Split

Adds editor-only diagnostics for mesh/weight/deform health: unweighted vertices, too many influences, missing bind coordinates, invalid bone references, overweight vertices, topology warnings, and deform offset mismatches. Also adds safe repair actions and viewport warning overlays. No runtime mesh schema change.


## v10.19 Weight Mirror / Symmetry Tools

Status: implemented.

- Added mirror tools in the Weights workbench.
- Supported Selected → opposite, Left → Right, and Right → Left workflows.
- Added Slot center X, Mesh bounds center, and Object root X symmetry axis modes.
- Added bone-name remapping for `_L/_R`, `.L/.R`, `-L/-R`, `L_/R_`, and `left/right`.
- Added preview diagnostics for matched pairs, unpaired vertices, and missing mirrored bones.
- Mirrored weights preserve partial weights and rebuild bind coordinates for destination vertices.


## v11 — Stable Runtime Export Format

Status: **done**

- Added a separate runtime-oriented export builder, `buildRuntimeDocument()`.
- Added validation for missing bones, invalid mesh triangles, unweighted vertices, missing bind coordinates, and deform-track references.
- Added Runtime JSON v11 next to Project JSON.
- Kept v11 runtime schema freeze as the next planned step.
