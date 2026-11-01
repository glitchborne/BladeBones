# BladeBones Architecture

Status: canonical direction and dependency rules for subsequent implementation.
Read this document and [CODE_STYLE.md](CODE_STYLE.md) before a non-trivial change.
This defines the target; it does not claim the current classic scripts already
implement these boundaries or authorize a project-wide rewrite.

Exact serialized fields and compatibility behavior remain governed by
[Project v11](PROJECT_FORMAT_PROJECT_V11.md) and
[Runtime v11](PROJECT_FORMAT_V11.md). This architecture changes no wire version,
document type, ID or existing playback invariant.

## Ownership and dependency direction

The application separates authoring data, numerical operations, playback state,
editor transactions and presentation. Arrows below mean **imports or calls**, not
the order in which data is serialized:

```text
application composition
  -> UI -> editor commands/services -> core authored data
                                   -> animation -> core, geometry
                                   -> geometry -> core data only
                                   -> IO -> core, runtime/model
                                   -> runtime preview API

runtime playback/rendering -> runtime/model, animation, geometry
animation                 -> core data, geometry numerical kernels
geometry                  -> core data only
core                      -> no higher application owner
runtime/model             -> no other application owner
```

Core data and Runtime DTOs are distinct representations. Shared numerical APIs
receive explicit read-only inputs and output buffers; runtime adapters translate
DTOs into those inputs. Algorithms do not require a complete editor `Project`.

| Owner | Allowed project dependencies | Forbidden responsibilities |
| --- | --- | --- |
| `core/` | Other core data/invariants; standard language APIs | UI, DOM, editor services, IO, playback loop, rendering, undo and global `state` |
| `geometry/` | Plain core geometry/mesh data | DOM, canvas coordinates implicit in algorithms, selection, tools, history, persistence |
| `animation/` | Plain core animation/rig data and numerical geometry kernels | Timeline, panels, selected keys, DOM, editor snapping preferences, IO |
| `runtime/model/` | Standard language APIs only; owns pure runtime contract validation | Editor types, global state, platform resources and playback mutation |
| Other `runtime/` | Runtime model, reusable animation/geometry APIs | Any editor/UI dependency, project autosave, history, tool state |
| `io/` | Core data, runtime/model DTOs, its own migrations/validation/transports | Viewport, panels, selection, rendering and editor command/history ownership |
| `editor/` | Core, animation, geometry, IO and explicit runtime preview APIs | Importing UI panels or allowing lower layers to call editor services |
| `ui/` | Public editor commands, services and read-only view models | Direct authored-data writes, algorithm ownership, calling a serializer from drawing code |
| Application composition | All required public entry points | Domain rules, format transformations and a new global service locator |

Runtime must never depend on Editor, including through a helper, callback default,
global lookup or transitive import. `core -> ui`, `animation -> panels`,
`geometry -> DOM`, `serializer -> viewport` and renderer writes to the document
are prohibited. No cyclic dependencies; resolve shared concepts at their lowest
semantic owner, not in a new `utils.js` or re-export barrel.

Platform use is explicit: runtime render backends may use Canvas/GPU interfaces;
`editor/viewport` may use DOM and screen transforms; IO transport adapters may
use injected file handles, storage or host APIs. Pure codecs, validators and
algorithms must remain callable without these facilities. A download button or
picker dialog belongs to outer editor/UI orchestration, not a JSON encoder.

## Target source layout

Create only directories needed by an actual extraction or feature. The current
`js/` files remain until individually migrated with their callers and tests.

```text
src/
  main.js                     application composition and explicit startup
  core/
    project/                  Project, SceneObject, attachments, cameras, layers
    rig/                      Rig, Bone, setup/bind data and invariants
    mesh/                     Mesh, Vertex, Weight data and invariants
    slots/                    Slot and display/setup data
    animation/                authored Clip, Track, Keyframe data records
  animation/
    clips/                    clip operations on core records
    tracks/                   track operations and sampling
    curves/                   interpolation and tangent math
    evaluator/                setup + tracks + time -> evaluated pose
  geometry/
    topology/                 knife, split, collapse, flip and index remaps
    triangulation/            triangulation kernels
    hit-test/                 numerical point/segment/triangle queries
    weights/                  influence operations and explicit normalization
  runtime/
    model/                    v11 DTO definitions and pure contract validation
    loader/                   validated DTO -> owned playback instance
    animation/                playback clock and shared evaluator adapter
    skinning/                 pose + bind data + FFD -> deformed vertices
    render/                   draw packet consumption and rendering backends
  editor/
    commands/                 authored mutations and undo records
    services/                 transactions, save/load orchestration, notifications
    selection/                editor-only selection and selection queries
    tools/                    drag/brush/knife interaction sessions
    viewport/                 editor camera, picking adapters and overlays
    history/                  undo/redo and document savepoints
    legacy/                   temporary, narrow classic-script adapters
  io/
    project/                  Project DTO mapping and JSON codec
    runtime/                  runtime export mapping and JSON codec
    migration/                versioned Project/Runtime input conversions
    validation/               pure structural/reference/semantic validation
    transport/                host file/storage adapters, no UI ownership
  ui/
    panels/
    timeline/
    dialogs/
tests/                        focused tests grouped as owners emerge
```

`core/animation` owns authored records so `core/project` can compose clips without
depending on the evaluator. `animation/clips` owns operations, not a second copy
of the data model. `runtime/model` owns the wire/playback representation; it is
not the editor model with fields removed dynamically.

## File and API boundaries

One file has one coherent concept or algorithm family and a small explicit API.
Do not create new `model.js`, `utils.js`, `helpers.js` or `manager.js` catch-all
files. A filename such as `slot-binding.js` must not accumulate panel rendering,
JSON dialogs and keyframe clipboard code. Put supporting functions beside their
owner; create another file when there is an independent responsibility or test
boundary, not merely to reduce line count.

Use physical line counts as review signals:

| Size | Required review response |
| --- | --- |
| Around 300-400 lines | Recheck whether the file still has one responsibility and readable functions. |
| 600+ lines | Splitting is normally expected; explain why a coherent algorithm is better kept together if retained. |
| 1000+ lines | Require an explicit architecture justification with owner, coupling and extraction plan. |

Generated icon tables and fixtures are evaluated as generated data, not manually
split to satisfy counts. Compressed multi-statement lines do not evade review.
Legacy files exceeding these signals are backlog, not a requirement to split
every file touched by a bug fix.

New isolated code uses named ES module APIs without mutable global exports. Each
extraction needs a tested public boundary and explicit integration/startup.
Classic `<script>` functions cannot synchronously import modules; module scripts
have different startup timing. A task introducing a module must wire readiness in
the composition/legacy adapter and test it rather than rely on script-order luck.

If a temporary classic bridge is unavoidable, keep it in one named adapter with
an explicit service/data input, a minimal immutable API and a documented removal
condition. Any newly exposed global bridge requires a short architectural
decision and review. No default new globals, new `state` bags, runtime discovery
with `typeof someGlobal`, reflection factories or generic service registry.

The current workflow UI uses this seam: `src/main.js` composes UI modules and an
explicitly injected `editor/legacy/workflow-adapter.js` after classic bootstrap.
See [Workflow workspace](UI_WORKFLOW.md) for the integration decision and removal
conditions. The domain/runtime owners remain on their existing implementations.

## Data ownership

| Concept | Canonical responsibility |
| --- | --- |
| Project | Authored aggregate: document type/name, objects/rigs, slots, meshes, attachments, clips, markers, saved poses and ToonDoc authoring settings. |
| SceneObject / Rig | Object groups a rig root and optional parent slot; Rig is the coherent authored bone/slot relationship. This conceptual owner introduces no new v11 JSON wrapper. |
| Bone | Stable ID, hierarchy, ownership, role and authored rest/setup transform; edit capabilities remain distinct from evaluation output. |
| Slot | Bone/object association, attachment and authored local/setup display state; slot ordering participates in draw order. |
| Mesh / Vertex | Geometry, topology, UVs, stable index relationships and bind data. Project slot-owned meshes map to separate runtime meshes by ID. |
| Weight | Bone reference, influence and bind coordinates. Partial sums up to one retain the v11 rest-space remainder policy; overweight/missing-reference data is not silently repaired by playback. |
| AnimationClip | Stable metadata, duration/rate, bone/slot/deform/camera tracks and authored events. |
| Track / Keyframe | Target identity, channel data, key times, interpolation/tangents and FFD offsets; unrelated to timeline row widgets or selected keys. |
| RenderLayer | Authored identity, order and visibility needed for ToonDoc composition; editor locking and UI display preferences stay outside playback state. |
| Camera | Authored ToonDoc camera setup and camera tracks, separate from the editor navigation camera. |

This is ownership guidance, not a command to introduce classes or duplicate
records. Field names and optional values follow the existing format documents.
Domain state includes authored intent, not DOM handles or a panel's derived label.

There are three distinct mutable lifetimes:

1. **Document:** edited by commands, persisted through the Project contract.
2. **Pose/playback instance:** local/world transforms, evaluated slot look/FFD and
   deformed vertex buffers. Evaluation writes here without changing setup, tracks
   or bind data. Instances may share read-only authored input, not mutable output.
3. **Editor session/view:** selection, hovered vertex, active tool/panel, viewport
   navigation, gizmo/drag sessions, history and render/export progress.

Project JSON intentionally saves a documented subset of editor preferences in its
`editor` envelope; persistence does not make these rig/domain data. Other transient
state and history are not Project fields. Current legacy `bone.local`, `slot.pose`
and `state` mix these lifetimes; new code must make ownership explicit.

For example, editor `cameraZoom` belongs to viewport navigation, while ToonDoc
camera `z`, setup and keyed camera motion are authored playback data. Runtime v11
already includes `activeAnimationId` and ToonDoc `activeCameraId`; do not remove
them based on a field-name heuristic. Existing runtime fields, including bone
presentation fields, remain governed by v11 until a separate compatibility decision.

## Commands and editor services

UI submits intent to editor APIs. Significant authored mutations progressively
use commands such as `MoveBoneCommand`, `DeleteVertexCommand`, `BindMeshCommand`,
`SetKeyframeCommand` and `ChangeWeightCommand`. A command can be a record or
function pair; a class framework is not required.

An undoable command owns `execute` and `undo` (or equivalent before/after data),
its affected IDs and the transaction's consistency. Validate preconditions before
committing writes. A topology transaction also remaps every affected clip's FFD,
UVs, weights and bind references; never leave a partially changed document.

Editor services coordinate command execution, history, dirty state, notifications
and save scheduling. Renderers subscribe/read the resulting state. A command does
not reach into panel DOM, serialize on every internal assignment or render midway
through a transaction. UI handlers never reproduce a mutation algorithm.

A drag/brush session may have a reversible preview and coalesce into one undo
entry on accept; cancel restores the prior state. Selection, hover, viewport pan
and playback-time changes are editor-session operations and need not become
authored-document undo commands. Existing snapshot-based undo remains supported
during migration; do not couple new kernels to `exportData()` for history.

## Geometry, animation and rendering

Geometry kernels accept numerical data/options and return a result or write an
explicit draft/output. Knife, edge flip, collapse, triangulation, hit testing and
weight normalization must be unit-testable without a mouse event or canvas.
Topology outputs include the reference/index changes needed by the command.
The editor converts pointer coordinates/tolerances and applies selection policy.
Geometry weight operations inspect references supplied as data; they do not call
global bone lookup or read the selected brush bone implicitly.

The timeline edits animation through commands. The evaluator samples explicit
setup/tracks/time into an output pose and never reads the timeline, calls
`renderInspector`, snaps according to editor preferences or inserts missing curves.
Sorting/defaults belong to validated input preparation or an editing command.
Runtime controls its clock/looping; the editor controls scrubbing/snapping.

Renderers consume prepared pose/mesh/draw-order inputs. They own graphics resources
and render buffers, not document structure or normalization. Editor overlays and
picking policy belong to `editor/viewport`; shared runtime rendering cannot depend
on selection, gizmos or workbench tabs. Onion skins evaluate separate output poses
instead of temporarily rewriting and restoring the live document.

## Persistence, runtime export and validation

Keep domain records, serialization DTOs and JSON distinct where their shapes or
lifetimes differ. Do not clone DTO types everywhere or require identical Project
and Runtime representations. Share a small mapping/default definition only when
it actually prevents read/write drift.

Target load path:

```text
host transport -> parse/envelope checks -> explicit version migration
  -> structural/reference/semantic validation -> detached candidate
  -> editor document-replacement transaction -> history/view notification
```

Target save/export paths:

```text
document snapshot + allowed editor preferences -> Project DTO -> JSON -> transport
authored document snapshot -> Runtime v11 DTO -> runtime validation -> JSON
```

IO codecs do not choose tools, update selections, clear history, render panels,
refresh image UI or invoke browser dialogs. Editor services perform those actions
after a successful operation. Unknown/malformed data must produce explicit
diagnostics; migrations/defaults are documented versioned policy, not a side effect
of painting a frame. Current defaults and aliases remain compatible with the
Project contract until a separately tested change is approved.

Validation is read-only and returns separate `errors` and `warnings`. Existing
runtime API is `{ ok, errors, warnings, stats }`; preserve it during extraction.
The runtime contract validator is a separate pure file owned by `runtime/model`;
both the runtime loader and `io/validation` call that same implementation.
Project validation and import diagnostic composition remain in `io/validation`.
New callers needing diagnostic locations can adopt stable codes/paths through an
explicit API change. Validators neither repair input, export JSON nor change UI.
Overweight influences, missing bone/slot/object references, invalid mesh indices,
hierarchy cycles, missing required setup and malformed animation data remain
errors according to v11. Warnings do not make invalid data valid.

Runtime includes only its documented playback contract: load, pose evaluation,
animation playback, skinning, FFD, draw order and rendering. It never consumes
selected objects, active tools, undo stacks, panels, gizmos, brush sessions,
topology selections or viewport navigation. Playback buffers/caches are runtime
instance state and are not serialized as authored data. Runtime loading validates
DTOs and builds owned instance state without importing editor persistence code.

## Legacy migration and decisions

The current implementation is a supported legacy baseline. A local bug fix may
remain in its existing file and use established mutation helpers. Do not increase
its responsibilities or introduce another global subsystem. Prefer a tested
owner boundary when adding new domain behavior; an exception needs a specific
reason, narrow scope and follow-up, not blanket grandfathering of all additions.

For larger changes prefer: (1) behavior/contract tests, (2) an isolated extraction
with the same public behavior, (3) the functional change. A small necessary
extraction may accompany a fix when its scope and tests make the risk clear.
No language rewrite, module-wide conversion, new UI, new animation system or
runtime viewer follows automatically from this document.

For a significant format, runtime or core-boundary decision, add a short section
to the owning document with **Decision**, **Reason**, **Consequences**. Include
compatibility/test effects and any temporary bridge removal condition. No separate
ADR framework is required. Architecture changes require updating this document;
wire changes also require the owning format contract and regression coverage.

## Current violations and bounded follow-ups

The following are observed legacy debt, not approved target dependencies:

- `js/state.js` combines authored arrays, DOM/canvas handles, pose/playback values,
  selection, tool sessions and undo history in shared globals.
- `js/model.js` combines rig/object operations, selection, snapshot history, mesh
  topology, weights and transforms; `js/panels.js` combines many independent
  inspectors and mutation handlers. Both exceed the normal size review signals.
- `js/model.js` selection paths call `renderAll`; object creation may consult
  viewport coordinates. `js/input.js` owns substantial session/mutation policy.
- `js/animation-curves.js` mixes interpolation, key editing, selection and UI
  evaluation. Sampling can insert default curves into authored keys;
  `evaluate()` updates inspector/time UI.
- `js/canvas-renderer.js` and hit/query paths call mutating initialization helpers.
  Onion rendering applies/restores shared animation pose rather than owning
  separate evaluation output. `panels.js:renderEventList` sorts authored events
  in place while drawing the list.
- `js/persistence.js` mixes Project/clip mappings, runtime export, validation,
  migration, autosave, transport and UI orchestration. `js/doc-types.js` wraps
  export/import and runtime generation, leaving multiple global integration seams.
- Script-order dependencies and shared names are implicit in `index.html`:
  `commands.js` declares both `savePose` and `applyPose` twice; `clearProject`
  exists in both `commands.js` and the later-loaded `doc-types.js`. Later
  declarations silently win. Intended behavior needs tests before consolidation.
  There is no standalone editor-independent runtime loader/evaluation boundary.
- Runtime declares `2d-y-down`, while viewport world-to-screen code flips world Y
  and runtime transform cleaning does not visibly convert Y. Confirm the intended
  exported coordinate convention with asymmetric fixtures in a separate contract
  task; do not silently flip coordinates or change the schema label here.

Recommended next units are: pure curve sampling with non-mutation tests; an
explicit Project/Runtime codec-validation boundary preserving round trips; one
topology kernel plus its complete FFD/index-remap command; and a command/history
service around one existing gesture. Extract and verify one responsibility at a
time, rather than splitting files mechanically or scheduling a full rewrite.
Before those extractions, pin duplicate-function winners and the coordinate
convention with focused behavioral tests; keep any format correction separate.
