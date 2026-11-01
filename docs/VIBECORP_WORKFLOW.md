# VibeCorp project workflow

## Project setup

Open this repository root as the selected VibeCorp project. Configure the provider/ACP adapter and worker policy in VibeCorp. The application supplies `VIBECORP_TASK_CLIENT` and the authenticated session bridge; no task-client implementation or session credentials belong in this repository.

The tracked project files are:

- `AGENTS.md`: shared project instructions and verification rules.
- `CLAUDE.md`: Claude Code entry point to the shared instructions; other supported agents read `AGENTS.md` directly.
- `.agents/skills/worker-orchestration/SKILL.md`: canonical delegation workflow.
- `.claude/skills/worker-orchestration/SKILL.md`: Claude skill entry point.
- `.vibecorp/verification.json`: captured test commands and optional preview.

Coding tasks require a clean committed Git root. Commit the intended project baseline, including the contract tests and these configuration files, through the normal user-authorized workflow before accepting coding workers. Existing dirty changes and ignored files are not copied to task worktrees. Do not automatically commit or stash unrelated changes.

## Verification profile

`node.exe` must be on PATH and support `node --test`. There is no dependency installation or bundler step. The profile runs the complete test suite from the task checkout root, including newly added test files discovered by Node. It is intentionally unscoped while the suite is small. Each command has a three-minute timeout; one automatic correction revision and bounded diagnostics are configured.

The optional preview requires Python 3 as `python.exe` on PATH. It serves the current checkout on loopback with an OS-assigned port. Open `http://127.0.0.1:PORT/index.html` using the printed port, then stop the preview after the browser check. Concurrent previews use separate ports. Preview is not a test or a required worker check; profile loading alone starts neither tests nor preview.

The Node suite uses browser stubs for document/runtime contracts. It does not establish correct rendering, input behavior, browser folder access or PNG output. Check those in Chromium when the task changes them.

VibeCorp captures the profile before starting a task and does not reload worker-edited configuration. Change verification configuration in the main checkout before creating tasks. Commands should work from an isolated Git worktree without relying on untracked assets or a fixed absolute project path.

## Task client

From PowerShell, use the supplied client path. Explicit interpreter invocation also works when the shell's default execution policy blocks direct `.ps1` execution:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $env:VIBECORP_TASK_CLIENT policy
```

Use this invocation prefix for all actions below. `policy` returns the current user-selected worker/reviewer models, reasoning and `maxParallel`; do not hardcode those values. If the environment variable is absent, this shell has no VibeCorp delegation session.

Example bounded task (choose paths appropriate to the actual goal):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $env:VIBECORP_TASK_CLIENT create -Title 'Audit clip round-trip' -Goal 'Inspect clip export/import against the project contract; report data-loss cases with file and test evidence.' -Mode read-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $env:VIBECORP_TASK_CLIENT list
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $env:VIBECORP_TASK_CLIENT status -Id 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $env:VIBECORP_TASK_CLIENT wait -Id 1
```

Coding tasks use `-Mode coding -Scopes 'js/persistence.js;tests/clip-roundtrip.test.js'`. Scopes are repository-relative prefixes and include every intended source/test change. The example test filename is a proposed task-owned file, not an existing test command. Overlapping scopes serialize; separate task cards do not make coupled global-state changes independent.

## Review, dependencies and delivery

- Coding tasks run in isolated detached Git worktrees and default to `-Review required`. Workers cannot recursively delegate or modify the main checkout automatically.
- Main owns design, decomposition, integration and acceptance. Prefer coherent bounded tasks over microtasks. Do not duplicate active worker scopes.
- `-Depends '1'` orders work and passes reports. It does not place task 1's uncommitted source into another checkout. If a coding task needs those bytes, deliver the predecessor before creating the dependent coding task.
- All accepted tasks capture their source revision. Keep HEAD unchanged while coding workers remain active. Main may handle independent work after acceptance; delivery later requires a clean main root and no active coding tasks for this project.
- Inspect actual checks, outcome, independent review and retained diff. `reviewStatus: skipped` is not reviewer approval. Required review remains appropriate for serialization, validation and complex logic.
- Before takeover after failure, inspect retained work and record a recovery decision from the skill. `NEEDS ATTENTION` may contain useful implementation. `resolve -Id N -Decision accept|fail -Note 'Evidence and decision'` changes dependency semantics; it never applies code.
- Retry through `create -RetryOf N -RetryReason 'Specific remaining problem'` with a bounded remaining goal. Respect the runtime limit of one automatic retry per logical task and two automatic standalone review rounds. Inspect partial evidence before retrying.
- After acceptance of the evidence, request `deliver -Id N -Fingerprint F` using the fingerprint from current task status, then `wait -Id N -Delivery`. Deliver disjoint tasks sequentially. Delivery creates a local task-only commit; it does not push. A refusal is not successful integration.
- Run any checks marked `MAIN CHECKOUT VERIFICATION REQUIRED` once in the main checkout. Verify the combined result after integration and stop when the task's acceptance criteria are supported.
- Archive/discard retained checkouts only after their evidence is accepted or deliberately rejected. Keep session tokens and descriptors out of logs, reports and source control.

## Scope of this integration

The VibeCorp application, task-client implementation, provider authentication and isolated VibeCorp instance launchers belong to the installed VibeCorp distribution. BladeBones needs its project profile and agent instructions. Development of BladeBones uses the static editor preview rather than building or launching another copy of VibeCorp.
