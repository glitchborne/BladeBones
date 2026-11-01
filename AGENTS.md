# BladeBones agent instructions

## Project and contracts

- BladeBones is a static browser application using Canvas 2D and shared JavaScript globals. `index.html` defines script loading order. There is no bundler or package installation step.
- Keep changes focused. Preserve the current architecture unless the user explicitly requests a larger migration.
- Read the owning implementation and relevant contract before changing behavior. Project serialization is documented in `docs/PROJECT_FORMAT_PROJECT_V11.md`; runtime export and validation in `docs/PROJECT_FORMAT_V11.md`; general ownership in `docs/ARCHITECTURE_NOTES.md`.
- Synchronize serialization changes with their canonical contract and focused regression tests. Preserve authored document data; keep temporary editor state out of runtime exports.
- Use existing model mutation helpers and the established `changed()` / rendering flow. Account for shared globals and script loading order when adding functions or files.
- Keep durable technical documentation in English.

## Verification and preview

- Run `node --test` from the repository root for the complete automated suite. The focused serialization command is `node --test tests/serialization.test.js`.
- No npm dependencies are required. Node.js must provide the built-in test runner.
- The Node suite covers document/runtime contracts with browser stubs. UI rendering, pointer interaction, folder access and image export still need a focused browser check when affected.
- For browser checks, use `python -u -m http.server 0 --bind 127.0.0.1` and open `/index.html` at the port printed by the server. Stop the server after checking. Chromium supports the folder save/load API.
- `.vibecorp/verification.json` is the captured worker verification profile. Its test command runs in isolated worktrees; its optional preview needs Python 3. Loading the profile does not start commands.
- Put disposable logs, probes and screenshots in `out/scratch/<topic>/`; do not treat ignored output as durable evidence. Record commands and results in the final report.

## VibeCorp workers

- When `VIBECORP_TASK_CLIENT` is available and substantial bounded work can be delegated, use the repo-local `worker-orchestration` skill at `.agents/skills/worker-orchestration/SKILL.md` before editing those scopes. Prefer VibeCorp tasks over provider-native subagents.
- Main Agent owns architecture, decomposition, integration, recovery and final acceptance. Delegate coherent implementation, test, audit or verification work when the boundary is useful; avoid artificial microtasks.
- Query the current worker policy before planning a substantial wave. Model, reasoning and concurrency belong to that policy; do not hardcode them.
- Coding workers require a clean committed Git root. Do not commit, stash, discard or include existing user changes merely to satisfy that requirement. Continue useful independent work and report the prerequisite when the root is dirty.
- Declare narrow repository-relative write scopes, including each task's test files. Several workers editing `js/model.js` or the same test file are overlapping work. Use one owner for coupled changes across shared globals.
- Follow `docs/VIBECORP_WORKFLOW.md` for dependencies, review, recovery and delivery. Workers never recursively delegate or apply code to the main checkout.
- Do not push or switch branches without user authorization. Do not create ordinary commits without authorization; an explicitly accepted VibeCorp delivery owns its task commit.
