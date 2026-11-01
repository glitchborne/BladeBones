---
name: worker-orchestration
description: Use the shared BladeBones VibeCorp worker workflow for substantial bounded implementation, test, audit or verification work when VIBECORP_TASK_CLIENT is available.
---

# Worker orchestration for Claude Code

Read `.agents/skills/worker-orchestration/SKILL.md` and follow the shared skill and its project workflow. Keep the policy in that canonical location.

Translate PowerShell task-client examples for the Bash tool:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$VIBECORP_TASK_CLIENT" policy
```

All actions and parameters remain the same. Use `-GoalFile` for long goals. If the environment variable is absent, continue without worker execution and do not claim that workers ran.
