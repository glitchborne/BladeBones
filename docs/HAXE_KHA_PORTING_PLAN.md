# Haxe + Kha Porting Plan

## Phase 1 — Model and serialization

- Define stable project schema.
- Implement asset references instead of data URLs.
- Implement world/local transform utilities.
- Implement command stack.
- Implement import from JS prototype JSON.

## Phase 2 — Viewport and scene tools

- Canvas/Kha renderer for grid, art, bones, markers.
- Selection filters.
- Move/rotate/scale gizmos.
- Art-first slot staging.
- Bind/unbind with world transform preservation.

## Phase 3 — Dope sheet

- Track tree.
- Key selection model.
- Box select.
- Move/scale/reverse/nudge selected keys.
- Clipboard.
- Timeline filters.

## Phase 4 — Animation systems

- IK targets.
- Constraints.
- Curve editor.
- Animation layers.
- Pose thumbnails.

## Phase 5 — Runtime/export

- Runtime JSON format.
- Game-engine preview runtime.
- Kha runtime playback.
- Optional exporters for Godot/Unity/Phaser/PixiJS.

## Keep from the JS prototype

- Three-mode workflow: Artwork / Rig / Animate.
- Art-first staging with unbound slots.
- Separate transport bar under timeline.
- Scene outliner with hierarchy and filters.
- Tabbed inspector.
- Project Health validation.

## v8 migration notes

Add these to Phase 1 schema work:

- `RigRoot` / `ProjectRoot` as a first-class model object.
- Import compatibility for JS `bones[]` entries with `isRoot: true`.
- Slot visual channels: alpha, tint color, tint mix, blend mode.
- Channel-level serialization so future graph editor can edit color/alpha independently from transform keys.

Add these to Phase 2 viewport work:

- Root transform gizmo.
- Clear visual distinction between project root, normal bones and art slots.
