# skills

Hand-authored agent skills that extend the [mattpocock/skills](https://github.com/mattpocock/skills) engineering pipeline: a design step between the spec and the tickets, and two executors that implement a set of tickets with agents.

## Installation

Prerequisite: install [mattpocock/skills](https://github.com/mattpocock/skills) and run `/setup-matt-pocock-skills` once per repo. Every skill here reads the issue tracker and domain docs that setup configures.

```sh
npx skills@latest add GionRubitschung/skills
```

Pick the skills you want and the agents to install them on. Update later with `npx skills update`.

**Claude Code users:** `/run-workflow` spawns seven subagents that the `skills` CLI cannot install. Add them as a plugin, then restart Claude Code:

```sh
claude plugin marketplace add GionRubitschung/skills
claude plugin install run-workflow-agents@gion-skills -s user
```

The plugin contains only the subagents, so nothing is installed twice.

## Why these skills exist

The pipeline from mattpocock/skills ends at `/to-tickets` and `/implement`: one ticket, one session. These skills cover what comes before and after.

- `/to-design` exists because otherwise the implementer decides the architecture. It turns a spec into modules with real signatures, a file layout and wiring, before any ticket is cut.
- `/to-plan` and `/run-plan` were the first executor: a plan with segments and checkpoints, run by an interactive agent team with a review panel and a merge gate. It grew too heavy: its segment reviews outgrew what a single session could carry.
- `/to-workflow` and `/run-workflow` are the second executor and the main flow. They run one ticket at a time with background agents, keep all state in git and ticket comments, and resume from any session.

## Where they sit in the pipeline

```
/grill-with-docs → /to-spec → [/to-design] → /to-tickets → /to-workflow → /run-workflow
                                                        └→ /to-plan → /run-plan
```

`/grill-with-docs`, `/to-spec` and `/to-tickets` come from mattpocock/skills. `/to-design` is optional; the chain works without it. `/to-workflow` and `/run-workflow` are the main flow; `/to-plan` and `/run-plan` are the alternate executor for runs that need live checkpoints and an agent team.

All pipeline skills are user-invoked (`disable-model-invocation: true`): they orchestrate, and the agent never reaches for them on its own.

## Reference

### to-design

```sh
npx skills@latest add GionRubitschung/skills --skill=to-design
```

Turns a spec from `/to-spec` into a fully concrete implementation design: modules with real signatures, file layout, data, wiring and rules. Posts it as a comment on the spec and mirrors it into the repo's architecture docs.

- **Input:** the spec (a `.scratch/<slug>/spec.md` path, an issue number or URL, or the one `/to-spec` produced in this session), plus `CONTEXT.md`, `docs/adr/`, `CODING_STANDARDS.md` and `ARCHITECTURE.md` when present.
- **Output:** a **Design** comment on the spec, and the docs moved to the intended state.
- **Uses:** `codebase-design`, `domain-modeling`, `grilling` from mattpocock/skills.
- **Downstream:** `/to-tickets` reads the design from the spec's comments; `/to-workflow` copies the latest design into `workflow.json`; `/run-workflow` pastes it into every implementer and reviewer prompt.

### to-workflow

```sh
npx skills@latest add GionRubitschung/skills --skill=to-workflow
```

Prepares one `.scratch/<slug>/workflow.json` that `/run-workflow` executes and never modifies. Spawns no agents; writes nothing until you approve the summary.

- **Input:** the tickets from `/to-tickets` (this session, a `.scratch/<slug>` directory, a parent issue, or a list of issue numbers), the latest **Design** comment, and the repo state.
- **Output:** `workflow.json` with the ticket DAG, the baseline (`feat/<slug>` in `.claude/worktrees/<slug>`), the verification commands, the models per role and `maxTurns`.
- **Guards:** stops on a dependency cycle, on a second checkout of the feature branch, and on uncommitted domain docs that the run's worktrees would not see.

### run-workflow

```sh
npx skills@latest add GionRubitschung/skills --skill=run-workflow
claude plugin install run-workflow-agents@gion-skills -s user   # Claude Code subagents
```

Executes a `workflow.json`. The session is the orchestrator: it spawns background agents, reacts to their one-line results, prints a board, and stops only when the run needs you or is finished. It never implements, reviews or merges anything itself.

- **Input:** the slug or the path of `.scratch/<slug>/workflow.json`.
- **Per ticket:** `implement → review (code, simplicity, security, verify) → (fix → verify)* → integrate`, each in its own worktree, merged fast-forward into the feature branch. Human tickets get a written guide instead.
- **State:** rebuilt from git and ticket comments on every start, so a new session resumes a run where the last one stopped.
- **Requires:** the `run-workflow-agents` plugin. Without it the first spawn is refused and the skill tells you the install commands.

### to-plan

```sh
npx skills@latest add GionRubitschung/skills --skill=to-plan
```

Turns a PRD's blocked-by issue graph into a segmented, dependency-DAG plan for `/run-plan`, and creates the baseline worktree it executes against. Interviews you to place checkpoints (scoped or barrier) and capture the decisions a human must make.

- **Input:** the issues from `/to-tickets`.
- **Output:** the plan file under `.scratch/<slug>/` with per-issue review lenses, plus the baseline worktree.

### run-plan

```sh
npx skills@latest add GionRubitschung/skills --skill=run-plan
```

Executes a plan from `/to-plan` with an orchestrated agent team: DAG-scheduled parallel TDD implementation in isolated worktrees, a diverse-lens review panel with durable findings threads, a product-owner gate, and a git-hook merge gate that blocks on red pipelines or open threads.

- **Input:** the plan from `/to-plan`.
- **Requires:** its agent stubs in `~/.claude/agents/`. Generate them once with the skill's `scripts/generate-agent-stubs.sh`, then restart Claude Code. The skill aborts when they are missing or stale.
- **Uses:** `tdd` from mattpocock/skills, and `ponytail-review` for the simplicity lens.

## Other skills

| Skill | Purpose |
|-------|---------|
| [`easy-language`](skills/easy-language/SKILL.md) | Persistent easy-language voice mode: short sentences, one idea each, everyday words, in whatever language you wrote in. `/easy-language` on, "normal mode" off. |

## Layout

```
skills/<name>/SKILL.md                      # one skill per directory, discovered by npx skills add
plugins/run-workflow-agents/agents/*.md     # Claude Code subagents for /run-workflow
.claude-plugin/marketplace.json             # the gion-skills marketplace
CONTEXT.md                                  # the terms these skills share
docs/adr/                                   # decisions behind the layout
```

## License

[MIT](LICENSE)
