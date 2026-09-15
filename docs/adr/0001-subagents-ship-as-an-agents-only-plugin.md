# Subagents ship as an agents-only Claude Code plugin; skills ship via npx

`/run-workflow` spawns seven `wf-*` subagent definitions, but the `skills` CLI (`npx skills add`) installs only skill folders and never writes to `~/.claude/agents/`. We ship the definitions as a separate Claude Code plugin (`run-workflow-agents`, from the `gion-skills` marketplace at this repo's root) that contains no skills, so every artifact has exactly one install path: skills via `npx skills add GionRubitschung/skills`, subagents via `claude plugin install`. Consequence: the skill spawns the scoped names `run-workflow-agents:wf-<role>`.

## Considered options

- Drop the definitions and spawn the built-in `general-purpose` agent with the brief — zero install, but the Agent-tool denial that keeps the run within the 20-subagent cap becomes prompt text only.
- A plugin carrying skills and agents — a Claude Code user who also runs `npx skills add` gets every skill twice, once namespaced.
- The skill symlinks or copies its `agents/` into `~/.claude/agents/` on first run — a hidden side effect outside the repo, plus a restart nobody asked for.
