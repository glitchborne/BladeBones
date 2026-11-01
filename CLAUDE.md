# BladeBones instructions for Claude Code

The shared project instructions apply unchanged:

@AGENTS.md

- The Claude skill entry point is `.claude/skills/worker-orchestration/SKILL.md`; it forwards to the canonical `.agents/skills/worker-orchestration/` skill.
- Claude Code's Bash tool uses POSIX environment syntax. Invoke the VibeCorp client through PowerShell:

  ```bash
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$VIBECORP_TASK_CLIENT" policy
  ```

- Use the same invocation for other task actions. Pass long goals through `-GoalFile` to avoid shell quoting problems.
- Use VibeCorp tasks for delegated work when the client is available. Worker models and reasoning come from the current user policy.
