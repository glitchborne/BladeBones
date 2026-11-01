# Mesh & Weight Editing Research

This document summarizes reference systems for Indie 2D's mesh, weights, FFD, and topology workflow. It is intentionally focused on implementation ideas rather than product comparison.

## Recommended direction for Indie 2D

Indie 2D should use a **DragonBones/Spine-like runtime model** with a **Godot/OpenToonz-like editor workflow**:

```text
artwork image
→ slot
→ mesh vertices / UV / triangles
→ derived edges / hull
→ bone weights
→ bind pose
→ animation keys
→ FFD deform offsets
→ runtime JSON export
```

Do not clone any one tool. Keep the project's own JSON model small, readable, and runtime-friendly.

## DragonBones

References:

- https://dragonbones.github.io/en/animation.html
- https://github.com/DragonBones/Tools/blob/master/doc/dragonbones_json_format_5.5.md

Useful concepts:

- Armature/Bone/Slot/Skin/Display hierarchy.
- Mesh display data stores vertices, UVs, triangles, weights, and bind-pose data.
- FFD keys store per-vertex offsets over time.
- Runtime applies weighted deformation from bones plus animation-time mesh offsets.

What to adopt:

```text
- explicit mesh display object per slot
- vertices + uvs + triangles as runtime data
- weights as per-vertex bone influence lists
- deformTracks as animation data, separate from setup mesh
```

What not to copy directly:

```text
- DragonBones' full armature export format complexity
- compatibility-only fields not needed by this editor
```

## Spine JSON reference

Reference:

- https://esotericsoftware.com/spine-json-format

Useful concepts:

- Mesh attachments use `uvs`, `triangles`, `vertices`, `hull`, and `edges`.
- Weighted mesh vertices encode multiple bone influences.
- `hull` and `edges` are useful for editor tooling even if the runtime can derive them.

What to adopt:

```text
- keep hull/edges in editor mesh data
- validate topology before export
- keep runtime and editor data cleanly separated later
```

## Godot Skeleton2D / Polygon2D

References:

- https://docs.godotengine.org/en/stable/tutorials/animation/2d_skeletons.html
- https://docs.godotengine.org/en/stable/classes/class_polygon2d.html

Useful concepts:

- Polygon2D owns polygon/UV data.
- Skeleton2D/Bone2D drive deformation.
- Weight painting is a distinct setup step after polygon/skeleton creation.
- Internal vertices/topology matter for believable bends.

What to adopt:

```text
- clear separation between mesh setup and animation pose
- active-bone weight overlay
- normalize/smooth weights as first-class actions
- warn when topology is too simple for bending areas
```

## OpenToonz Plastic Tool

Reference:

- https://opentoonz.readthedocs.io/en/latest/create_animations_using_plastic_tool.html

Useful concepts:

- Mesh creation is separate from skeleton animation.
- Mesh editing operations include Swap Edge, Collapse Edge, Split Edge, and Cut Mesh.
- The mesh is a deformation layer linked to artwork.

What to adopt now:

```text
- Split Edge
- Collapse Edge
- Swap Edge
- Select Hull
```

What to defer:

```text
- full Cut Mesh / hole workflows
- alternate skeletons for different shapes
- complex plastic-style layer systems
```

## Synfig Skeleton Deformation

References:

- https://wiki.synfig.org/Skeleton_Deformation_Layer
- https://synfig.readthedocs.io/en/latest/layers/skeleton.html

Useful concepts:

- Skeleton deformation can work as raster/pixel deformation.
- A deformation layer can affect rendered output below it rather than game-runtime mesh data.

Indie 2D decision:

```text
GameDoc should stay mesh/weights/runtime oriented.
ToonDoc may later support heavier render-only deformation features.
```

## AnimeEffects

References:

- https://github.com/hidefuku/AnimeEffects
- https://animeeffectsdevs.github.io/

Useful concepts:

- Open-source 2D animation based on polygon mesh deformation.
- Good proof that a mesh deformation workflow can remain lightweight.

Caution:

```text
AnimeEffects is GPL-3.0. Study ideas and UX only; do not copy code into a differently licensed project.
```

## COA Tools / Blender

References:

- https://github.com/ndee85/coa_tools
- https://github.com/Aodaruma/coa_tools2

Useful concepts:

- Blender already has mature mesh editing, armatures, vertex groups, and animation systems.
- COA Tools uses Blender as a 2D cutout rigging environment.
- COA Tools 2 emphasizes automatic mesh generation and direct editing.

What to adopt later:

```text
- alpha-outline / automatic mesh generation
- mirror weights
- direct mesh edit UX
- cleaner export pipeline for game runtimes
```

## Implementation implications for Indie 2D

### Data model

Use stable mesh setup data:

```json
{
  "version": 3,
  "vertices": [],
  "triangles": [],
  "edges": [],
  "hull": []
}
```

Keep animation-time offsets separate:

```json
{
  "deformTracks": {
    "slotId": [
      { "t": 0.0, "offsets": [] }
    ]
  }
}
```

### Editor stages

```text
1. Mesh topology setup
2. Weight assignment / normalization / smoothing
3. Bind pose validation
4. Animation / FFD keys
5. Export validation
```

### Immediate priority

```text
Done in v10.1 / v10.2 / v10.3 / v10.4 / v10.5 / v10.6 / v10.8 / v10.9:
- mesh v3 schema
- edges/hull
- direct vertex / edge / triangle selection
- split/collapse/swap edge
- knife v1 for edge and triangle insertion
- weld/delete selected mesh elements
- topology validation hooks
- bottom Mesh Workbench for Binding / Mesh / Weights
- shared transform gizmo for vertices, edges, and triangles
- resizable horizontal lower workbench
- polished box selection for vertices, edges and triangles
- context-aware all/invert selection and loose vertex cleanup
- View and Pick Filters moved into a collapsible side panel
- explicit Weight Paint session with Apply/Cancel

Next:
- multi-segment knife paths
- guided binding workflow
- better per-vertex weight inspector
- stronger topology diagnostics
- auto mesh from alpha outline
```


## v10.9 Weight Paint Session implementation note

The editor now follows the common DCC pattern used by Blender/Godot-style weight painting: select an active bone, explicitly enter a paint session, paint vertex influence in the viewport, then Apply or Cancel the session. The current implementation is per-vertex and screen-radius based, which fits the existing triangle mesh runtime and keeps the data model compatible with DragonBones/Spine-style weighted mesh exports.


## v10.10 Weight Adjust Session implementation note

The editor now supports a second explicit weight editing session beside brush paint. This follows the direct-manipulation UX used by many DCC tools: select one or more vertices, choose the active bone, enter Adjust, then use drag distance as a scalar input for the selected vertex weights. The operation preserves the existing normalized-weight model and bind-coordinate refresh.


## v10.11 Weight Gauge implementation note

Spine's Weights view documents vertex pies where slices match bone colors and an overlay mode for showing bone colors across the mesh. Indie 2D v10.11 adopts the same readability idea but adapts it to the current active-bone workflow: each vertex draws a filled circular gauge for the active bone, with percentage labels when selected, hovered, or touched by the brush. DragonBones' skinning model confirms the same core concept that individual mesh vertices are attached to different bones, so the viewport should make each vertex's active influence explicit rather than relying on opacity alone.


## v10.12 Weight Adjust implementation note

Filled gauges exposed an important UX issue: a mathematically normalized one-bone vertex always becomes 100%, so reducing it visually requires either another bone influence or an explicit unassigned/rest remainder. Indie 2D now uses the second approach for editor sessions: partial single-bone weights are preserved, and the empty gauge area represents rest/unassigned influence. Once additional bones exist, the remaining weight is distributed across them.
