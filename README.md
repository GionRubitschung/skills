# skills

Hand-authored agent skills, version-tracked. Registry-compatible layout: one skill per `skills/<name>/` directory.

## Skills

| Skill | Purpose |
|-------|---------|
| [`to-plan`](skills/to-plan/SKILL.md) | Turn a PRD's blocked-by issue graph into a phased, parallel implementation plan and create the baseline worktree it executes against. |
| [`run-plan`](skills/run-plan/SKILL.md) | Execute a `/to-plan` plan with an orchestrated agent team — parallel TDD in isolated worktrees, review loops, merge into the baseline branch. |

`to-plan` produces a plan; `run-plan` consumes it.

## Install

Point a skill manager at this repo (`sourceType: github`, `skillPath: skills/<name>/SKILL.md`), or symlink a skill directory into your agent's skills path:

```sh
ln -s "$PWD/skills/to-plan" ~/.agents/skills/to-plan
```

## Layout

```
skills/<name>/SKILL.md   # required entrypoint
skills/<name>/...        # bundled references, role prompts, etc.
```

Versioning is git history — the skill manager pins to a commit by folder hash.
