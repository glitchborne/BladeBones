# Workflow-centered workspace

The workflow navigation exposes four presentation stages over the existing editor:

| Stage | Main task | Contextual workspace |
| --- | --- | --- |
| ART | Import/place artwork and organize objects | Artwork library; selected artwork transforms |
| RIG | Draw bones, establish hierarchy and attach artwork | Rig hierarchy; transform/rig properties, parent bone and setup pose |
| MESH | Prepare deformation when needed | Binding, topology or weights workbench for selected artwork |
| ANIMATE | Create clips, key transforms and preview motion | Clip tools, transport, timeline and contextual animation properties |

Mesh binding is optional for rigid slot animation. FFD remains in the existing
animation inspector for a selected enabled mesh. Stage changes are navigation,
not a new animation system or a change to the Project/Runtime format.

## Disclosure and reachability

New/Open/Save/Undo/Redo are document actions; viewport tools retain their existing
shortcuts and tooltips. Clear document is under Project / More. Workspace contains
panel visibility/reset actions, View / Tools and Data. View / Tools contains
filters plus collapsed marker and project-diagnostics sections. Data contains
Project JSON/local save/load/recovery and Runtime JSON validation/download.

Hierarchy retains object, rig and draw-order views with compact entity labels.
Inspector prioritizes the current selection and common transforms; technical
Data/Elastic and binding diagnostics use Advanced disclosures. Controls are moved
as the original DOM nodes so their existing handlers and IDs remain intact.

Key selected / Key all / Auto key move into the ANIMATE tool row. Clip controls
remain visible while scrolling timeline settings. Hierarchy filters and document
settings are collapsed separately from the entity list. Mesh workbench cards use
their natural height with an outer scroll area instead of clipping each card.

Empty states offer a single next action rather than a blocking tutorial. The
navigation mode and current tool remain explicit. Weight/test-pose sessions must
be applied/cancelled/exited before a conflicting stage change; the UI never
silently discards their preview.

## Integration decision

**Decision:** retain the classic script bootstrap and dynamically import the new
module composition root after it has initialized. Pass the existing state,
commands and view callbacks explicitly into one temporary editor/legacy adapter.
New UI modules receive detached presentation snapshots and bounded action APIs.

**Reason:** current controls and callbacks depend on the classic script order.
Explicit injection provides a small migration seam without enlarging panels.js,
input.js or exposing another mutable global namespace.

**Consequences:** workflow state, disclosures and utility drawers remain
module-local/DOM presentation state. They introduce no new serialized fields.
DOM observation is limited to legacy render roots and coalesced after existing
actions; it is not per-frame domain evaluation. A ResizeObserver updates canvas
size after layout changes. The legacy adapter still knows old control IDs and
history conventions; remove that dependency as individual command services are
extracted, rather than introducing a generic service locator.

The adapter's Rig attachment control delegates to the existing keep-world parent
command, history and changed/render boundary. Setup buttons invoke the existing
setup commands. These are additional presentation locations for existing actions.
When starting the legacy bone tool from artwork, the adapter selects that artwork's
object root first. The existing drag command then creates bones in the visible
rig hierarchy; its bone-creation and hierarchy algorithms remain unchanged.

## Verification

Run `node --test` for contract, workflow policy and adapter regressions. Browser
acceptance uses Python Playwright with its installed Chromium:

```text
python tests/browser/workflow-smoke.py
```

The script serves this checkout on an assigned loopback port, generates a small
synthetic artwork fixture, exercises the existing editing commands, captures
startup/GameDoc/artwork/rig/animation states at 1600x900, and checks all four modes
at 1920x1080, 1600x900 and 1366x768. It writes screenshots and a JSON report under
the ignored scratch artifact directory and closes its server/browser in cleanup.
Folder Open/Save use an in-memory File System Access handle in the automated run;
native folder-prompt/permission behavior remains a browser/manual integration check.

Task 03 acceptance on 2026-11-01: `node --test` passed 56 tests; the Chromium
scenario passed 63 checks and captured 10 screenshots with no page errors. The
browser checks include topology editing, a weight stroke/cancel, FFD keys,
diagnostics during animation, Runtime validation, ToonDoc layers and camera view.

## Remaining architectural limits

- Legacy renderers still normalize mesh/curve data while reading and rebuild
  inspector DOM after many actions. Presentation adapters cannot fix this safely.
- Snapshot history still serializes the Project; this task does not replace it
  with a new command/history framework.
- Legacy panel generators own mesh/binding control markup and some UI mutation
  policy. New disclosure modules adapt those controls instead of duplicating their
  algorithms. Extract one command/view responsibility at a time in later tasks.
- Keyboard mode aliases and persisted legacy layout settings still exist behind
  the workflow shell. Their behavior is reconciled at the explicit legacy seam.
- Coordinate orientation remains the existing renderer behavior; the earlier
  architecture follow-up about viewport/runtime Y conventions is not resolved by
  this presentation task.
