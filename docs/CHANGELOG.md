# Changelog

## v11 — Stable Runtime Export Format

### Added
- Froze the runtime payload as `indie-2d-runtime-v11` with `version: 11` and `schemaVersion: 11.0.0`.
- Added top-level `meshes[]` runtime data; slots now reference meshes by id instead of embedding runtime mesh data inline.
- Added explicit `setupPose.bones` and `setupPose.slots` maps for runtime initialization.
- Added stable mesh export fields: vertices, weights, triangles, edges, hull, deform setup, and `weightSumPolicy`.
- Added stricter `validateRuntimeDocument()` checks for schema version, slot/mesh references, parallel vertex/weight arrays, triangle indices, bind coordinates, setup pose entries, and deform-key offset counts.
- Added **Download Runtime v11** in Data / Export.
- Added `docs/PROJECT_FORMAT_V11.md` with the stable runtime schema and migration notes.

### Changed
- `buildRuntimeDocument()` now emits the final v11 runtime structure instead of the v10.20 staging preview.
- Runtime validation UI now reports v11 conformance.
- Project save version updated to `indie-2d-v11-stable-runtime-export`.

### Notes
- Full Project JSON remains the editor save format. Runtime JSON v11 is the clean payload intended for game/runtime playback.

## v10.19 — Weight Mirror / Symmetry Tools

### Added
- Added a **Mirror / symmetry** card to the Weights workbench.
- Added mirror directions: Selected → opposite, Left → Right, and Right → Left.
- Added symmetry axis modes: Slot center X, Mesh bounds center, and Object root X.
- Added bone-name remapping for `_L/_R`, `.L/.R`, `-L/-R`, `L_/R_`, and `left/right` conventions.
- Added mirror preview counts for source vertices, paired vertices, unpaired vertices, and missing mirrored bones.

### Changed
- Mirrored destination vertices rebuild their bind coordinates after copied weights are applied.
- Missing mirrored bone pairs keep the original influence and are reported instead of being silently removed.

## v10.18 — Binding Layout Split

### Changed
- Split the Binding workbench into two sub-tabs: Workflow and Advanced / diagnostics.
- Kept the guided binding flow and compact slot status in Workflow.
- Moved Setup / Bind Pose, Deformation Test Pose, diagnostics, manual parent, and manual bind actions to Advanced / diagnostics.
- Guarded Binding event wiring so hidden sub-tab controls no longer require DOM placeholders.

### Fixed
- Reduced horizontal overflow and visual crowding in the lower workbench when Binding is active.

## v10.17 — Deformation Diagnostics

### Added
- Added Binding workbench diagnostics for unweighted vertices, too many influences, missing bind coordinates, missing bone references, overweight vertices, topology issues, and deform offset mismatches.
- Added viewport warning overlays for problem vertices.
- Added safe one-click fixes: auto-weight unweighted vertices, prune/clean influences, rebuild bind coordinates, fix deform offsets, and fix all safe issues.
- Added Test Pose health summary in diagnostics: moved bones, affected slots, and unweighted vertex count.

### Changed
- Binding status now pairs the old binding summary with a deeper mesh/deformation health panel.


## v10.15 — Setup Pose Guard

### Added
- Added explicit Setup / Bind Pose controls in the Binding workbench.
- Added Set Bind Pose, Restore Bind Pose, Rebind weights, and Animate test actions.
- Added slot `setupLocal` so slot animation samples from a stable setup transform instead of the last edited animation pose.

### Changed
- Switching from Animation mode back to Rigging mode now restores the setup/bind pose to prevent accidental rig corruption.
- Animation sampling now resets bones to `rest` and slots to `setupLocal` before applying keys.

### Fixed
- Slot transforms can no longer silently become the new setup pose just because an animation frame was sampled.


## v10.14 — Binding Workflow

### Added
- Added a guided Binding workflow with status cards for **Parent Slot → Create Mesh Topology → Bind / Auto-Weight → Test Deformation**.
- Added **Quick rigid** for parent-only sprite binding.
- Added **Quick mesh setup** to parent the slot when needed, create a 3×3 mesh, auto-bind available object bones, enable weight gauges, and jump to Weights.
- Added Binding-tab shortcuts for 3×3 / 4×4 mesh creation, Auto Object Bones, Parent Chain, Open Mesh, Open Weights, and Test deformation selection.

### Changed
- Binding tab now leads with the guided workflow and keeps manual parent/bind actions as secondary controls.
- Clarified rigid parent binding versus weighted mesh binding in the UI and documentation.

### Notes
- No runtime mesh schema change. This is a rigging workflow and workbench UX update.


## v10.13 — Weight Panel Cleanup

### Changed
- Moved **Vertex Selection** to the left side of the Weights tab.
- Moved **Brush** controls to the right side of the Weights tab, near the viewport paint/adjust session controls.
- Removed the noisy per-vertex weight debug log from **Auto / Region Bind**.

### Notes
- No runtime mesh schema changes. This is a workbench layout cleanup only.

## v10.12 — Weight Adjust Fix

### Fixed
- Fixed sticky 100% weight gauges when reducing a vertex that only had the active bone influence.
- Weight Adjust and Weight Paint now preserve partial single-bone values instead of normalizing them back to 100% until zero.
- Viewport deformation now treats the missing remainder as implicit rest/unassigned influence.

### Changed
- `ensureSlotMesh()` and `ensureMeshTopology()` now sanitize mesh weights without forcing partial sums up to 1.0.
- `slotMeshBoneWeightTarget()` keeps the active bone at the exact requested target and only normalizes the remaining weight when other bone influences exist.

## v10.11 — Weight Gauges

### Added
- Added filled vertex weight gauges in the viewport for the active bone.
- Added numeric percentage labels on selected / hovered / brushed vertices.
- Added fallback multi-influence pies when no active bone is selected.

### Changed
- Replaced alpha-only weight dots with explicit circular fill indicators.
- Updated Weights panel copy to describe filled gauges instead of a generic heatmap.

### Notes
- Runtime mesh schema is unchanged. This is an editor viewport UX improvement only.

## v10.10 — Weight Adjust Session

### Added
- Added **Start Adjust** in Mesh Workbench → Weights.
- Added direct mouse weight adjustment for selected vertices. Drag right/up to increase active-bone weight; drag left/down to decrease.
- Added Shift fine-control and adjustable sensitivity for Weight Adjust.
- Added viewport adjust crosshair/label and active-bone delta feedback.

### Changed
- Weight editing now has two explicit modal sessions: Paint and Adjust.
- Apply / Cancel semantics are shared across both sessions.


## v10.9 — Weight Paint Session

### Added
- Added an explicit modal Weight Paint session with Start Paint, Apply, and Cancel controls.
- Added keyboard flow: P starts/applies paint, Enter applies, Esc cancels.

### Changed
- Weight Paint no longer auto-exits when the brush touches a bone; rigging picks resume only after Apply/Cancel.
- Brush overlay appears only while a paint session is active.

### Fixed
- Prevented accidental bone selection from stealing focus during weight strokes.


## v10.8 — Rigging UX Layout Fix

### Added
- Added a collapsible View / Pick Filters side panel between the viewport and Inspector.
- Moved Assets / Markers into the lower rigging workbench under the viewport.

### Changed
- Lower rigging workbench now uses a 1/3 Assets / Markers pane and a 2/3 Binding / Mesh / Weights pane.
- Lower rigging workbench is hidden in Animation mode.
- Bone picks in Rigging mode escape active Mesh context and non-session Weight context, so clicking a bone returns to rigging edits.

### Fixed
- Non-session Weight Paint no longer traps clicks when the user is trying to return to bone rigging edits.


## v10.7 — Weight Paint UX

### Added
- Added viewport Weight Paint mode in the Mesh Workbench → Weights tab.
- Added active-bone brush painting with **Add**, **Subtract**, **Smooth**, and **Replace** modes.
- Added brush controls for size, strength, replace target value, and selected-vertices-only painting.
- Added live brush circle overlay and active-bone heatmap hit highlighting in the viewport.
- Added `P` shortcut to toggle Weight Paint / Select mode and `[` / `]` shortcuts to resize the brush.
- Added normalization/pruning after brush edits so vertex weights remain runtime-safe.

### Changed
- Weights tab now separates manual vertex selection from brush painting.
- Weight painting preserves bind coordinates by rebinding edited influences after each stroke.
- Project JSON version updated to `indie-2d-v10-doc-types-v10.7-weight-paint-ux`.

### Known limitations
- Weight Paint v1 paints vertices inside a circular brush; it does not yet paint interpolated continuous texture-space areas between vertices.
- Smooth mode currently smooths the active bone weight across neighboring mesh vertices; full multi-bone blur and locked weights are planned later.

## v10.6 — Knife Tool v2

### Added
- Added drag-line Knife Tool workflow in Mesh mode.
- Added viewport preview line while dragging the knife.
- Added multi-triangle cuts: one drag can split all crossed triangles along the knife line.
- Added shared-edge reuse so adjacent triangles use the same inserted vertex on the same crossed edge.
- Added automatic interpolation of UVs, vertex weights, and FFD/deform offsets for inserted knife vertices.
- Kept Knife v1 point behavior for quick clicks on edges or triangle interiors.

### Changed
- Mesh HUD now explains `K click point / drag line` behavior.
- Mesh Workbench notes now describe point cut vs line cut.

### Known limitations
- Knife v2 is a straight drag-line cut. It is not yet a multi-segment Blender-style click path with confirm/cancel points.
- Ambiguous cuts exactly through existing vertices are intentionally conservative and may be ignored; offset the line slightly for predictable topology.

## v10.5 Mesh Selection Polish

### Added

- Added robust viewport box selection for mesh vertices, edges, and triangles.
- Added Shift-add and Ctrl/Cmd-toggle behavior for mesh box selection.
- Added **Invert** selection in the Mesh Workbench.
- Added selected element counters as compact pills for vertices, edges, and triangles.
- Added **Clean Loose Verts** to remove vertices that are no longer referenced by any triangle while keeping deform offset arrays aligned.
- Added root `ROADMAP.md` with implemented status and the next release plan.

### Changed

- Edge box selection now uses segment/rectangle intersection, so partially covered edges are selected instead of only midpoint hits.
- Triangle box selection now uses triangle/rectangle intersection, so partially covered triangles are selected instead of only centroid hits.
- The Mesh tab now treats **All** as context-aware: all vertices, all edges, or all triangles depending on the active selection mode.
- Updated project JSON version to `indie-2d-v10-doc-types-v10.5-mesh-selection-polish`.

### Notes

- Runtime topology is still triangle-based. There is no true n-gon polygon mode yet; the UI exposes triangles.
- Knife v2 now supports drag-line cutting through multiple triangles; multi-segment path cutting is still future work.

## v10.4 Resizable Mesh Workbench

### Added

- Added a resizable lower workbench height controlled by the same drag-resize pattern as the animation timeline.
- Added `layout.meshWorkbenchH` and CSS variable `--mesh-workbench-h` so the lower viewport workbench size is persisted with the rest of the layout.
- Added a horizontal two-pane workbench layout:
  - left pane: **View** and **Pick Filters**;
  - right pane: **Binding**, **Mesh**, and **Weights** tabs.

### Changed

- Doubled the default lower workbench target height to `420px`.
- Moved **View** and **Pick Filters** out of the right Inspector and into the lower viewport workbench.
- Reworked the Mesh Workbench CSS for horizontal usage: compact cards, scrollable pane bodies, two-column mesh tab grids, and a dedicated row-resizer above the workbench.
- Updated project JSON version to `indie-2d-v10-doc-types-v10.4-resizable-mesh-workbench`.

### Notes

- The right Inspector is now focused on selected object data and animation-specific panels. Viewport visibility, pickability, binding, mesh editing, and weight setup live below the viewport.
- Runtime topology is still triangle-based. There is no true n-gon polygon mode yet; the UI exposes triangles.
- Knife v2 now supports drag-line cutting through multiple triangles; multi-segment path cutting is still future work.

## v10.3 Mesh Workbench

### Added

- Added a bottom **Mesh Workbench** under the viewport for selected slots.
- Added workbench tabs for **Binding**, **Mesh**, and **Weights**.
- Added shared gizmo support for selected vertices, edges, and triangles. Edge and triangle selections transform through their mirrored vertex group.
- Added Triangle wording in the UI for triangle-face selection so it does not imply n-gon polygon support.

### Changed

- Removed Rigging-mode **Binding**, **Mesh**, and **Weights** tabs from the right Inspector.
- Slot setup now flows through the viewport workbench instead of the Inspector.
- Mesh selection/gizmo hit-testing now checks the gizmo before edge/triangle picking, so selected edges and triangles can be moved, scaled, and rotated with the same handles as vertices.
- Updated project JSON version to `indie-2d-v10-doc-types-v10.3-mesh-workbench`.

### Notes

- Runtime topology is still triangle-based. There is no true n-gon polygon mode yet; the UI exposes triangles.
- Knife v2 now supports drag-line cutting through multiple triangles; multi-segment path cutting is still future work.

## v10.2 Mesh Editor UX

### Added

- Added explicit Mesh element selection modes: **Vertex**, **Edge**, and **Face**.
- Added direct viewport edge picking instead of requiring two selected vertices.
- Added direct viewport triangle-face picking.
- Added hover highlights for vertices, edges, and faces.
- Added Knife v1:
  - click an edge to split it at the cursor position;
  - click inside a face to insert a new vertex and split the triangle into three triangles.
- Added topology actions:
  - Weld Selected Verts;
  - Delete Selected Element for vertex / edge / face mode.
- Added keyboard shortcuts in Mesh mode:
  - `1` Vertex mode;
  - `2` Edge mode;
  - `3` Face mode;
  - `K` Knife / Select toggle;
  - `F` Flip selected edge;
  - `Delete` delete selected mesh element.

### Changed

- Edge and face selections now mirror their affected vertices into `selectedVerts[]` so selected elements can be dragged as vertex groups.
- Split operations can now interpolate at the actual cursor position, not only at the edge midpoint.
- Face insertion, edge splitting, and welding interpolate UVs, vertex weights, and FFD offsets.
- Mesh documentation now describes the direct editor UX instead of the earlier two-vertex edge workaround.
- Browser title and project JSON version updated to `v10.2 Mesh Editor UX`.

### Notes

- Knife v1 is a point operation. It does not yet cut a continuous path through multiple triangles.
- Polygon mode currently means triangle-face selection. Runtime topology remains triangle-based. Higher-level n-gon groups can be layered on later.

## v10.1 Mesh Topology and Research Pass

### Added

- Added `mesh.version = 3` normalization for slot meshes.
- Added derived `mesh.edges[]` and `mesh.hull[]` topology data.
- Added topology helpers in `js/model.js`:
  - `ensureMeshTopology()`
  - `rebuildMeshEdgesFromTriangles()`
  - `rebuildMeshHullFromTriangles()`
  - `meshTopologyIssues()`
  - `splitSlotMeshSelectedEdge()`
  - `collapseSlotMeshSelectedEdge()`
  - `swapSlotMeshSelectedEdge()`
  - `selectSlotMeshBoundary()`
- Added Slot → Mesh topology tools:
  - Split Edge
  - Collapse Edge
  - Swap Edge
  - Select Hull
  - Rebuild Edges/Hull
- Added selected-edge highlight in the mesh viewport overlay.
- Added mesh topology warnings to project validation.
- Added technical documentation:
  - `docs/MESH_WEIGHTS_RESEARCH.md`
  - `docs/MESH_WEIGHTS_ROADMAP.md`
  - `docs/PROJECT_FORMAT_V10.md`
- Rewrote `README.md` as developer documentation.

### Changed

- Mesh creation now passes through `ensureMeshTopology()` so old meshes are migrated to v3 on load/export.
- Grid meshes now initialize `edges[]`, `hull[]`, `dirtyTopology`, and `bindPoseVersion`.
- Split/collapse operations update FFD deform offset arrays to keep vertex-index alignment.
- README now describes architecture, data model, document types, mesh v3, topology tools, weights, FFD, import/export, limitations, and roadmap.
- Browser title updated to `v10.1 Mesh Topology`.

### Notes

- This is still a prototype. The new topology tools are intentionally minimal and local.
- The next implementation pass should focus on weight brush UX, stronger topology validation, and runtime/editor data separation.

## v10 Doc Types

### Added

- GameDoc and ToonDoc document types.
- New Project dialog.
- ToonDoc camera, canvas, render layers/passes, and PNG export.
- Folder save/load flow using `project.json` and `assets/`.

## v9.x Historical Notes

- Scene objects MVP.
- Slot parent + mesh weights workflow.
- Undo/Redo.
- FFD deform tracks.
- Grouped dope sheet timeline.
- Viewport tool split between rigging and animation modes.

## v10.16 — Deformation Preview / Test Pose

### Added
- Added explicit Deformation Test Pose controls in the Binding workbench.
- Added Start Test Pose, Reset Test Pose, and Exit Test Pose actions.
- Test Pose lets bones be moved temporarily to preview mesh deformation without writing keyframes or modifying setup/bind pose.
- Viewport shows a Test Pose badge and rest/setup ghost while previewing.

### Changed
- Rigging transforms no longer write `bone.rest` while Test Pose is active.
- Slot transform edits avoid writing `slot.setupLocal` while Test Pose is active.

