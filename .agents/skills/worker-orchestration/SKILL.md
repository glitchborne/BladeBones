---
name: worker-orchestration
description: Plan and run substantial bounded BladeBones implementation, test, audit or verification work through the VibeCorp task client when available. Use before editing delegation-eligible scopes. Do not use for trivial edits or tightly coupled work without a useful worker boundary.
---

# Worker orchestration

1. Read `AGENTS.md` and the [project workflow](../../../docs/VIBECORP_WORKFLOW.md). They define project checks and the task lifecycle. Keep task-client paths, models and concurrency supplied by the current VibeCorp session.
2. Confirm that `VIBECORP_TASK_CLIENT` exists in the environment. If absent, work without workers and do not claim delegation occurred. Query `policy` before planning a substantial wave.
3. Decide architecture and fixed invariants first. Identify coherent worker work, Main-owned work and dependencies. Main keeps architecture, cross-cutting integration, user decisions and final acceptance.
4. Before accepting coding tasks, check that the Git root is clean and committed. Existing user changes are not worker input and must not be automatically committed, stashed or discarded. Read-only work remains a possible independent task.
5. Give each worker a complete bounded goal, relevant contracts, repository-relative write scopes, acceptance evidence and expected report. Use file-level scopes where separate JavaScript files can be changed safely. Keep coupled shared-global changes with one owner; reserve separate test files when tasks run concurrently.
6. Create useful independent tasks and explicit dependencies. `maxParallel` bounds running workers, not the task graph. A dependency passes ordering and reports, not uncommitted predecessor source. Deliver required source first and create the next coding task against the resulting revision.
7. Default coding tasks to independent review. Keep required review for formats, architecture and complex behavior. A small mechanical change may use `-Review none` only with an explicit reason; skipped review is not approval.
8. While workers run, handle useful independent Main work. Do not duplicate active scopes or change HEAD while coding workers remain active. Wait through the task client when no independent work remains; inspect intermediate state only for a concrete coordination decision or failure.
9. Before taking over a failed coding scope, inspect status, outcome, partial evidence, actual checks, independent review and retained checkout while the main root remains clean. Record `USE RETAINED WORK`, `RETRY BOUNDED WORKER`, `MAIN-OWNED WITH REASON`, or `ABANDON`. Prefer useful retained work or a bounded worker retry where safe.
10. Inspect completed results and diffs before delivery. Resolve dependency semantics explicitly where needed. Delivery is a separate fingerprint-bound action; wait for all active coding tasks to finish, ensure the main root is clean, and deliver tasks sequentially. Run checks marked `MAIN CHECKOUT VERIFICATION REQUIRED` in the main checkout.
11. Report actual checks, review status, integration and remaining limits. For browser behavior, the Node contract suite does not replace a focused real-browser check. Stop verification once the agreed criteria have sufficient evidence.
