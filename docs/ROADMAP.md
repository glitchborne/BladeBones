# Roadmap

This roadmap tracks implemented editor milestones and the next planned work for the mesh/weights pipeline.

## Implemented

### v10.1 — Mesh topology foundation

Status: **done**

- Normalized slot meshes to `mesh.version = 3`.
- Added derived topology helpers for `edges[]` and `hull[]`.
- Added topology validation and weight normalization/pruning helpers.
- Kept FFD/deform offset arrays aligned when topology changes add or remove vertices.

### v10.2 — Direct mesh editor UX

Status: **done**

- Added explicit mesh selection modes: **Vertex**, **Edge**, and **Triangle**.
- Added direct viewport picking for vertices, edges, and triangles.
- Added hover and selected rendering for mesh elements.
- Added Knife v1 and topology actions: Split, Collapse, Flip, Weld, and Delete.

### v10.3 — Mesh Workbench

Status: **done**

- Moved **Binding**, **Mesh**, and **Weights** out of the right Inspector into a lower viewport workbench.
- Made selected edges and triangles transform through the same gizmo as selected vertices.
- Renamed Face/Polygon wording to **Triangle** because runtime topology is triangle-based.

### v10.4 — Resizable lower workbench

Status: **done**

- Made the lower workbench resizable by height.
- Increased default workbench height to `420px`.
- Moved **View / Pick Filters** out of the Inspector and later into a collapsible side panel.

### v10.5 — Mesh selection polish

Status: **done**

- Added box selection for vertices, edges, and triangles.
- Added **Shift** add and **Ctrl/Cmd** toggle behavior.
- Added context-aware All/Invert selection and visible selection counters.
- Added **Clean Loose Verts**.

### v10.6 — Knife Tool v2

Status: **done**

- Added drag-line Knife workflow with live viewport preview.
- Added line cuts through multiple triangles in one gesture.
- Added shared-edge insertion reuse and local retriangulation.
- Interpolated UVs, vertex weights, and FFD/deform offsets for inserted knife vertices.

### v10.7 — Weight Paint UX

Status: **done**

- Added viewport Weight Paint mode in the lower Mesh Workbench.
- Added active bone selector, brush size, strength, replace target, and selected-verts-only painting.
- Added Add/Subtract/Smooth/Replace brush modes and per-stroke normalization/pruning.

### v10.8 — Rigging UX Layout Fix

Status: **done**

- Moved **View / Pick Filters** into a collapsible side panel.
- Moved **Assets / Markers** into the lower rigging workbench.
- Changed the lower workbench split to **1/3 Assets / Markers** and **2/3 Binding / Mesh / Weights**.
- Hid the lower Rigging workbench in Animation mode.

### v10.9 — Weight Paint Session

Status: **done**

- Added explicit **Start Paint**, **Apply**, and **Cancel** controls.
- Made Weight Paint modal while active so bone/slot clicks no longer steal focus mid-paint.
- Added `Enter` to apply and `Esc` to cancel.

### v10.10 — Weight Adjust Session

Status: **done**

- Added modal Start Adjust / Apply / Cancel flow.
- Mouse drag adjusts selected vertices for the active bone.
- Right/up increases weight; left/down decreases weight.
- Added Shift fine-control and sensitivity slider.

### v10.11 — Weight Gauges

Status: **done**

- Added filled vertex gauges for active-bone weight.
- Added numeric percent labels on selected / hovered / brushed vertices.
- Added fallback multi-influence pies when no active bone is active.

### v10.12 — Weight Adjust Fix

Status: **done**

- Fixed sticky 100% active-bone gauges during Weight Adjust.
- Preserved partial single-bone weights with implicit rest/unassigned remainder.
- Kept multi-influence vertices normalized when other bones are available.

### v10.13 — Weight Panel Cleanup

Status: **done**

- Moved **Vertex Selection** left in the Weights workbench.
- Moved **Brush** controls right, next to the viewport paint/adjust session area.
- Removed the bottom per-vertex debug weight log from the main UI.

### v10.14 — Binding Workflow

Status: **done**

- Added guided Binding workflow: **Parent Slot → Create Mesh Topology → Bind / Auto-Weight → Test Deformation**.
- Added per-step status cards with Done / Needs Work / Next / Optional states.
- Added **Quick rigid** and **Quick mesh setup** actions.
- Added fast actions for mesh creation, Auto Object Bones, Parent Chain, Open Mesh, Open Weights, and Test bone selection.
- Kept manual parent and bind actions available as secondary controls.

### v10.15 — Setup Pose Guard

Status: **done**

- Added explicit **Set Bind Pose**, **Restore Bind Pose**, **Rebind weights**, and **Animate test** actions in the Binding workbench.
- Added stable `slot.setupLocal` as the setup baseline for slot animation.
- Animation sampling now resets bones from `rest` and slots from `setupLocal` before applying keys.
- Returning from Animation mode to Rigging mode restores the setup/bind pose to avoid accidental rig corruption.

### v10.16 — Deformation Preview / Test Pose

Status: **done**

- Added temporary **Test Pose** mode for checking weighted mesh deformation.
- Added **Start Test Pose**, **Reset Test Pose**, and **Exit Test Pose** controls in the Binding workbench.
- Bone dragging previews deformation without writing keyframes and without mutating setup/bind pose.
- Setup/rest ghost overlay is shown during preview.
- `Esc` exits/restores setup; `Enter` resets while staying in Test Pose.

### v10.17 — Deformation Diagnostics

Status: **done**

- Added warning list for unweighted vertices, too many influences, invalid/missing bone references, missing bind coordinates, overweight vertices, topology issues, and mismatched deform offsets.
- Added viewport warning overlays for problem vertices.
- Added safe one-click fixes: auto-weight unweighted vertices, prune/clean influences, rebuild bind coordinates, fix deform offsets, and Fix all safe.
- Added Test Pose health summary: moved bones, affected slots, and unweighted vertex count.

### v10.18 — Binding Layout Split

Status: **done**

- Split Binding into **Workflow** and **Advanced / diagnostics** sub-tabs.
- Workflow keeps the fast guided bind path visible.
- Advanced holds setup pose, test pose, diagnostics, manual parent, and manual bind controls.
- Reduced horizontal overflow and visual crowding in the lower workbench.

## Next planned stages

### v11 — Stable runtime export format

Status: **done**

Goal: freeze a clean, runtime-friendly format for Haxe/Kha or another engine runtime.

Implemented:

- Stable runtime header: `format`, `schema`, `version`, `schemaVersion`, `sourceVersion`.
- Stable mesh schema in top-level `meshes[]`.
- Stable weights schema with per-vertex influences and explicit bind coordinates.
- Stable deform setup and deform track validation.
- Explicit `setupPose.bones` and `setupPose.slots`.
- Runtime validation for references, topology, bind coordinates, setup pose, and deform key offsets.
- Migration path from v10.x editor data through `buildRuntimeDocument()`.
- Clear separation between Project JSON editor saves and Runtime JSON v11 exports.
- `docs/PROJECT_FORMAT_V11.md`.

### v11.1 — Runtime Viewer / Smoke Test

Status: **planned**

Goal: load exported Runtime JSON v11 without the editor UI and verify rendering/playback in a minimal standalone viewer.

Planned:

- Standalone runtime viewer page.
- Load exported runtime JSON.
- Draw skeleton, slots, and weighted meshes.
- Sample one animation clip.
- Verify deform tracks and setup-pose reset.
