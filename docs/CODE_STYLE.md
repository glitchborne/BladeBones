# BladeBones Code Style

Status: canonical rules for new and materially changed code. Read this document and
[ARCHITECTURE.md](ARCHITECTURE.md) before implementing a non-trivial change.
Existing compressed classic scripts are legacy, not examples to copy. Improve the
touched responsibility without reformatting unrelated code.

## Language and tooling

BladeBones currently uses plain browser JavaScript, classic scripts loaded by
`index.html`, and Node's built-in test runner. There is no installed formatter,
linter, bundler, TypeScript compiler or npm dependency installation step.

Use JavaScript and browser-native ES modules for new isolated subsystems, with the
integration policy in ARCHITECTURE.md. Classes are optional; do not introduce a
class where a record and a function express the behavior. Use JSDoc for exported
domain data shapes, units, ownership and non-obvious return contracts.

The formatting rules below are the current source of truth and use conventional
Prettier-compatible choices. Do not invent a custom formatter. If a later task
installs a standard formatter, its committed configuration becomes authoritative
for mechanical formatting; synchronize this document and keep mass formatting
separate from behavior changes. No formatter or automatic gate is installed by
this document.

## Names

| Kind | Rule and BladeBones example |
| --- | --- |
| Files and directories | Lowercase kebab-case: `mesh-topology.js`, `bind-pose.js`, `hit-test/`. Keep existing filenames until an intentional move. |
| Classes, JSDoc types | PascalCase: `AnimationClip`, `MeshVertex`, `MoveBoneCommand`. Use `Id`, not `ID`, inside compound names. |
| Functions and methods | camelCase, verb plus subject: `evaluateClip`, `findBone`, `validateRuntimeDocument`. A factory uses `create`; a query must not initialize data. |
| Local variables and parameters | camelCase, one declaration per statement. Use `slotId`, `vertexIndex`, `worldPoint`; short `i`, `x`, `y`, `u`, `v` are appropriate inside small mathematical loops. |
| Fixed constants | UPPER_SNAKE_CASE for domain limits and tolerances: `MAX_BONE_INFLUENCES`, `KEY_TIME_EPSILON_SECONDS`. Ordinary `const` locals remain camelCase. |
| Enums | PascalCase container, UPPER_SNAKE_CASE members: `TrackKind.BONE`. In JavaScript use a module-local frozen record; wire values remain their contract strings. |
| IDs and indices | An opaque string reference uses `Id`: `boneId`, `renderLayerId`. A numeric array position uses `Index`: `vertexIndex`. Never use them interchangeably. |
| New boolean APIs | State or capability names: `isVisible`, `hasWeights`, `canDelete`, `shouldUpdate`. Avoid `visibleFlag`, `weightBool`, `deleteState` and ambiguous negative flags. |
| Handlers | `handlePointerMove`, `handleDeleteVertex`; commands name the requested action. Avoid generic `onChange` when the affected domain can be named. |
| Internal notifications | Stable `owner:past-tense-action` strings, such as `mesh:topology-changed` or `project:loaded`. Define a shared notification name once in its owner, not in a global event registry. |

Native DOM event names stay unchanged. Animation event `name` and `payload` are
authored content, not internal notifications; preserve them exactly. Enum values
already present in v11, such as `circleCross`, are not renamed to satisfy a new
identifier convention.

IDs survive rename, array reordering, save/load and export. Do not derive identity
from a display name or parse meaning from a numeric suffix. Keep existing IDs such
as `b1`, `obj1`, `cam1` and runtime mesh IDs intact. Generate IDs through the owning
creation path; copied entities need an explicit reference remap.

## Formatting

- Use two spaces, no tabs; LF text and a final newline; no trailing whitespace.
- Use semicolons, single-quoted JavaScript strings and template literals only for
  interpolation or multiline text. JSON uses double quotes as required by JSON.
- Put opening braces on the declaration/control-flow line, `} else {` together,
  and closing braces on their own line. Use braces for every control-flow body,
  including an early return. Do not compress multiple statements onto one line.
- Target 100 columns. Wrap expressions and calls when that makes them readable.
  URLs, generated icon data and indivisible literals may exceed it; do not split
  identifiers or hide a multi-purpose function in one long line.
- Use spaces around binary operators, after commas and after control keywords:
  `if (mesh) {`. No space before a named function's argument list:
  `function evaluateClip(clip) {`. Use spaces inside single-line object braces;
  arrays and parentheses have no inner padding.
- Use one blank line between top-level declarations and between distinct phases
  of a function. Do not insert blank lines between every assignment or more than
  two consecutive blank lines.
- Small coordinate records may stay inline: `{ x: 0, y: 0 }`. Put independent
  fields and nested records on separate lines when the object becomes long.
  Multiline arrays use one item per line unless a small matrix/triangle row is
  clearer as one item. Never reorder persisted arrays for formatting.
- Long parameter lists/calls put one parameter/argument per line. Avoid positional
  boolean sequences; use an options record such as `{ preserveWorld: true }`.
- Use trailing commas in multiline objects, arrays and named import/export lists.
  Do not use trailing commas in function parameter or call lists. No trailing
  commas in JSON.
- Module imports come first: platform/external dependencies, project dependencies,
  then local relative dependencies, with one blank line between nonempty groups.
  Sort paths within a group. Use explicit `.js` extensions and named imports;
  avoid wildcard imports, circular barrel files and side-effect imports. Classic
  script ordering stays explicit in `index.html` until its bounded migration.

```js
function findVisibleMesh(slot) {
  if (!slot || !slot.visible) {
    return null;
  }

  return slot.mesh ?? null;
}
```

## Functions and ownership

Describe a function's responsibility in one sentence. A function named
`validateMesh` must not normalize the mesh, add history, update DOM and serialize
the project. Separate the algorithm, command and UI orchestration even when they
currently reside in one legacy file.

Prefer early returns over nesting. More than three nested control-flow levels or
a function approaching 60 lines is a review prompt, not a line-count game: split
independent phases into owner-specific functions, not generic `helpers` files.
Do not split a coherent numerical kernel just to meet a count.

Use `const` unless rebinding is needed, then `let`; do not add `var`. Use `===` and
`!==`. The explicit `value == null` null-or-undefined check is acceptable at an
optional-data boundary. Use `??` for numeric/boolean defaults when both `null`
and `undefined` mean missing; it preserves `0` and `false`, but replaces `null`.
When `null` means an intentionally empty attachment, preserve it with an explicit
undefined check: `slot.attachment !== undefined ? slot.attachment : fallback`.
Do not use `||` or `??` to replace that authored empty value.

Every new domain API must state ownership through its name and JSDoc where needed:

| API kind | Allowed effects |
| --- | --- |
| `get*`, `find*`, `has*`, `is*`, sampling/query functions | Read inputs; do not create defaults, sort the caller's arrays or initialize caches on the project. |
| `validate*` | Read input and return diagnostics; do not repair it. |
| `encode*`, `serialize*`, export mapping | Read a validated snapshot and build detached DTO/JSON; no authored-state writes. |
| `migrate*`, `normalize*` | Return an explicit converted value plus diagnostics at an input boundary. An unavoidable in-place variant must say `InPlace` and document its write set. |
| Commands/domain mutation functions | Mutate only the declared document or draft, within the owning transaction. |
| Evaluation/skinning | Read authored setup/tracks and write an explicitly supplied pose/output buffer. |
| Renderer | Write its Canvas/GPU context and renderer-owned buffers, never the authored document. |

Writing caller-owned output buffers is not permission to modify source vertices,
keys, weights or setup transforms. Do not return mutable internal arrays as an
unrestricted editing API. A read-only view may share data when callers honor the
read-only contract; cloning everything is not required.

`ensureSlotMesh`, `ensureToon`, `normalizeKeyCurve` and `ensureClipStore` currently
have mutation behavior. Do not call them from new read-only paths. Initialization
and migration belong before evaluation, rendering and serialization. Existing
`changed()` calls may be used at the legacy command boundary, not inside a new
geometry kernel or serializer.

## Globals and dependencies

Do not add global mutable bindings, global function declarations, `window` exports,
implicit singleton caches or new fields on the global `state` object as the normal
way to extend the application. A top-level `const` containing a mutable object is
still global mutable state. New pure global helpers also increase hidden coupling.

Keep new subsystem internals module-local, pass data/services explicitly, and
export a small named API. Use a bounded legacy adapter when integration needs one;
ARCHITECTURE.md defines its exception and startup rules. Do not convert the whole
script chain, introduce dependency injection machinery, or add modules/classes
across unrelated files just to satisfy this policy.

## Errors and malformed input

- Throw an exception for an impossible internal invariant, unsupported operation
  that cannot return meaningful data, or failed IO. Catch at the service boundary
  that can preserve the document and explain the failure. Preserve the cause.
- Return a validation result for expected malformed Project/Runtime input. Keep
  `errors` and `warnings` separate; errors block acceptance/export consumption.
  Existing runtime results use `{ ok, errors, warnings, stats }` with message
  arrays. Do not change this API incidentally; new diagnostics should have stable
  codes and paths when callers need to locate problems.
- Use warnings only for a documented valid-but-degraded condition. Broken
  references, invalid indices, cyclic hierarchy and invalid weight sums remain
  errors under the v11 contract. Never demote them to make tests pass.
- Fail fast before expensive processing for an invalid envelope/version or a
  safety-critical invariant. Collect independent recoverable field diagnostics
  where it is safe; do not traverse an invalid cyclic hierarchy indefinitely.
- Parse, check and migrate into detached data before replacing the live document.
  A failed operation must preserve document, selection, history and save state.
  This is the target boundary; current import orchestration needs gradual repair.
- A legacy alias/default is allowed only for a documented migration or documented
  optional field. Report conversions and skipped unsupported data at the import
  boundary. Do not silently clamp malformed current-format values, discard tracks
  or treat invalid data as a successful load. Existing migration behavior remains
  governed by the Project contract until a tested compatibility change replaces it.
- No empty `catch` blocks in new code. User cancellation is a distinct expected
  result. Autosave failures must be observable without corrupting the saved file
  or turning a successful in-memory edit into a partial edit.

## Contracts, units and numerical values

The exact Project and Runtime wire names come from
[PROJECT_FORMAT_PROJECT_V11.md](PROJECT_FORMAT_PROJECT_V11.md) and
[PROJECT_FORMAT_V11.md](PROJECT_FORMAT_V11.md). They take precedence over the
naming rules for existing fields. In particular:

- Use `renderLayerId` for the object's render-layer reference, not a mixture of
  `layer`, `renderLayer` and `renderLayerIndex`.
- Preserve `slot.bone`, `bone.parent`, `object.root`, `parentSlot`, `cameraTracks`,
  `visible`, `affectWeights`, key time `t` and weight `w` at their defined boundary.
  A new local parameter can be `boneId`; do not add a second serialized synonym.
- Accept legacy aliases such as `parentBone` or clip `tracks` in the documented
  compatibility boundary. New internal APIs use one term; existing emitted aliases
  remain until a separate format decision changes them.
- Topology changes must explicitly preserve/remap vertex indices, UVs, weights,
  bind coordinates and every affected clip's FFD offsets. An index is part of the
  animation relationship, not just an array implementation detail.
- Runtime wire units are pixels, degrees, seconds and `2d-y-down` as declared in
  v11. Make world/local/screen conversions and Canvas radians explicit; do not
  infer the editor's internal axis convention from the wire label or silently
  change legacy sign conversions during extraction.

Use named constants for domain tolerances, influence limits, brush defaults,
iteration bounds and byte-channel ranges when they have meaning. Keep a constant
with its semantic owner; do not create a global constants dump. Record the unit
and reason. `0`, `1` and small algebraic coefficients need no invented name.
Do not reuse one `EPSILON` for time, geometry and weights. Numerical tolerance and
runtime rounding changes require boundary tests and contract review.

## Comments and performance

Explain why an invariant, workaround or algorithm choice exists. Do not narrate an
assignment. Prefer a short `//` comment before the relevant code; use JSDoc for an
exported API's contract. Link a concrete follow-up or decision for temporary
workarounds, rather than leaving an unexplained TODO.

```js
// Keep vertex indices stable because FFD tracks address offsets by vertex index.
const sourceVertexIndex = vertexIndex;
```

Animation evaluation, skinning, FFD, rendering and hit testing are potential hot
paths. Avoid per-vertex `map`/spread/temporary records or repeated full-project
lookups in an established hot loop when an explicit output buffer/index can be
reused. Allocate buffers per playback/renderer instance, resize on topology change,
and document ownership. Do not add global pools, mutate authored data for cache
convenience, or optimize unrelated code without a reproducible measurement.

## Tests and review

Add a focused regression test for a serialization, geometry, animation or runtime
bug whenever the behavior is reproducible. Test input/output invariants and failure
diagnostics, not incidental helper names or source text. New domain logic must be
callable without a DOM, canvas, selected tool or panel.

Use Node's built-in runner (`node --test`). Current serialization tests load
classic scripts into a VM with browser stubs; that is a legacy harness, not a
requirement for new pure modules. Add tests beside the relevant responsibility
under `tests/`, with explicit file names and small failure messages. Browser
interaction and visual behavior require a focused browser check when affected.

Review function ownership, dependency direction and contract preservation before
cosmetic consistency. Keep a behavior fix, broad formatting and large extraction
in separate changes unless a small extraction is necessary to make the fix safe.
