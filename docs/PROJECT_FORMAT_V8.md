# Project Format v8

Current prototype version:

```text
indie-2d-skeleton-v8-root-color-prototype
```

## Project root bone

Every project should contain a master root bone:

```json
{
  "id": "root",
  "name": "project_root",
  "parent": null,
  "isRoot": true,
  "rest": { "x": 0, "y": 0, "r": 0, "len": 70 },
  "local": { "x": 0, "y": 0, "r": 0, "len": 70 }
}
```

In this JS prototype root is represented inside `bones[]` for compatibility, but it is semantically a project/master transform. For Haxe + Kha, consider modeling it as a first-class `SceneNode` or `RigRoot` instead of a normal endpoint-connected bone.

Important behavior:

- `project_root` cannot be deleted;
- top-level bones are parented to it;
- children under root keep local X/Y offsets;
- root can have animation keys to move/rotate the entire character.

## Bones

Bones store rest and current local pose:

```json
{
  "id": "b1",
  "name": "upper_arm_L",
  "parent": "root",
  "rest": { "x": -30, "y": 70, "r": 30, "len": 70 },
  "local": { "x": -30, "y": 70, "r": 42, "len": 70 }
}
```

For a normal bone parent, children start at the parent endpoint. For `project_root`, child local X/Y is treated as a positional offset relative to root origin.

## Slots / artwork

A slot can be bound or unbound:

```json
{ "id": "s1", "bone": "b1" }
{ "id": "s2", "bone": null }
```

`bone: null` is the art-first staging state.

Slots now also carry visual properties:

```json
{
  "alpha": 1,
  "tint": "#ffffff",
  "tintAlpha": 0,
  "blendMode": "normal"
}
```

These properties also exist inside `pose` so animation evaluation can override them.

## Slot tracks

Slot keys can store transform, visibility, attachment and visual look:

```json
{
  "t": 0.5,
  "visible": true,
  "alpha": 0.6,
  "tint": "#ff8844",
  "tintAlpha": 0.75,
  "blendMode": "multiply",
  "attachment": "a1",
  "x": 30,
  "y": 0,
  "r": 0,
  "sx": 1,
  "sy": 1,
  "curve": { "type": "smooth", "x1": 0.33, "y1": 0, "x2": 0.67, "y2": 1 }
}
```

Alpha and tint interpolate. Attachment, visibility and blend mode are treated as stepped/held properties in the prototype.

## Clips

Clips are stored in `animations[]`:

```json
{
  "id": "clip1",
  "name": "walk",
  "duration": 1.2,
  "fps": 24,
  "boneTracks": {},
  "slotTracks": {},
  "events": []
}
```

## Editor settings

Editor-only settings live under `editor`:

```json
{
  "projectRootId": "root",
  "pick": {},
  "onion": {},
  "timeline": {},
  "layout": {},
  "art": {},
  "outliner": {},
  "color": {},
  "inspectorTab": "transform"
}
```

For production, split runtime data and editor-only workspace data into separate files.

## Hermite bone keys

Elastic Smart Bake can write cubic Hermite keys:

```json
{
  "t": 0.25,
  "x": 0,
  "y": 0,
  "r": 12.5,
  "len": 80,
  "curve": { "type": "hermite" },
  "inTangent": { "x": 0, "y": 0, "r": -120, "len": 0 },
  "outTangent": { "x": 0, "y": 0, "r": 90, "len": 0 }
}
```

Tangents are value velocities per second. `outTangent` is used for the segment leaving the key; `inTangent` is used for the segment entering the key.

### Bone scale and quad mesh MVP

Bone transforms may include `sx` and `sy` in both `rest` and `local` transforms. Missing values should be treated as `1`.

Slots may include a `mesh` object:

```json
{
  "enabled": true,
  "vertices": [
    { "x": -50, "y": -50, "weights": [] },
    { "x": 50, "y": -50, "weights": [{ "bone": "b1", "w": 1, "x": 10, "y": 0 }] }
  ],
  "triangles": [[0, 1, 2], [0, 2, 3]]
}
```

An empty `weights` array means the vertex follows the slot transform. Weighted vertices follow their bound bone local coordinates.

## Scene objects extension

Newer builds may include:

```json
{
  "objects": [
    { "id": "obj1", "name": "Character", "root": "b1", "parentSlot": null, "visible": true }
  ]
}
```

Each non-scene-root bone can have `objectId` and an object root bone can have `objectRoot: true`. Slots can also have `objectId`; unbound slots are evaluated in the local space of their object root. If `parentSlot` is set, the object root is evaluated relative to that slot transform, which allows an object to be nested inside another object.
