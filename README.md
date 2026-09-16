# skills

Hand-authored agent skills that extend the [mattpocock/skills](https://github.com/mattpocock/skills) engineering pipeline: a design step between the spec and the tickets, and two executors that implement a set of tickets with agents.

## Installation

### Prerequisites

These skills call other people's skills by name, so install those first:

1. **[mattpocock/skills](https://github.com/mattpocock/skills)**, then run `/setup-matt-pocock-skills` once per repo. Every skill here reads the issue tracker and domain docs that setup configures, and they invoke `grilling`, `domain-modeling`, `codebase-design`, `to-spec`, `to-tickets`, `code-review` and `tdd` from that repo.

   ```sh
   npx skills@latest add mattpocock/skills
   ```

2. **[ponytail](https://github.com/DietrichGebert/ponytail)** as a Claude Code plugin. The implementers run under `ponytail:ponytail` and the simplicity review is `ponytail:ponytail-review`; both are called by their plugin-scoped names, so the plugin install is required, not the npx one.

   ```sh
   claude plugin marketplace add DietrichGebert/ponytail
   claude plugin install ponytail@ponytail -s user
   ```

3. **`security-review`** from [getsentry/skills](https://github.com/getsentry/skills). The security reviewer invokes it.

   ```sh
   npx skills@latest add getsentry/skills --skill security-review
   ```

### The skills

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

### The problem: one spec, many tickets, one session

The mattpocock/skills pipeline goes grill → `/to-spec` → `/to-tickets` → `/implement`. That last step implements one ticket in the current session. For a small change that is fine. A spec worth writing down produces five to fifteen tickets, and then the loop becomes: run `/implement` on ticket 1, wait, read the diff, commit, run `/implement` on ticket 2, wait, read the diff, and so on, by hand, for every ticket. It is tedious, and it is where quality slips.

It slips for two reasons. First, the session that wrote the code is the session that reviews it, with a context full of its own decisions, so the review is not really independent. Second, the review is one-dimensional: `/code-review` checks the diff against the spec and the coding standards, but a simplicity review with the ponytail discipline never fit into that loop, and neither did a security pass or a verification run. Over a big spec the small compromises add up and the code drifts toward a ball of mud, even though every single ticket looked fine.

### What the executors do instead

`/to-workflow` reads the tickets and their blocked-by edges, the design from `/to-design`, and the project's test, lint, typecheck and build commands, and writes one `workflow.json` describing the run. `/run-workflow` then executes it, ticket by ticket, without you:

1. Every ticket whose blockers are merged gets its own implementer: a fresh background agent in its own worktree on its own branch, with nothing in its context but the ticket, the design and the coding standards. Nothing from the other tickets, nothing from this README, nothing from your chat.
2. When the implementer is done, four reviewers look at the result, each one a fresh agent with one job: a code review against the ticket and the standards, a ponytail review that hunts for what to delete, a security review, and a verifier that runs the project's real test, lint, typecheck and build commands.
3. Findings go back to the implementer as a fix turn, then the verifier runs again. Green means a merger rebases the ticket branch and fast-forwards it into the feature branch. A ticket that is still red after `maxTurns` is handed to you with a comment on the ticket saying exactly what failed.
4. Tickets that only a person can do get a written guide instead of an implementation. After every transition the session prints a board with the state of every ticket.

`/to-plan` and `/run-plan` do the same job with a different shape: a plan with segments and checkpoints, executed by an interactive agent team with a review lead, a lens panel and a product-owner gate. That was the first version and it is still here, but it is the alternate route. See below for why.

### Why the output is better

Each agent sees one ticket, not the whole spec, so it cannot cut corners on ticket 7 to make up for ticket 3. The reviewers did not write the code they review. Simplicity is a review stage of its own, so the ponytail discipline is applied to every ticket instead of being something you remember to ask for. And nothing merges before the project's own commands pass. The code that comes out of a run is noticeably better than what `/implement` produces on one big spec in one session. The price is tokens: six agents per ticket plus two per fix round. For me that price is worth paying.

### Working on several things at once

A run needs nothing from you until it finishes or a ticket fails. So the working rhythm becomes: grill and spec feature A, cut its tickets, start its executor, and while it runs, start grilling feature B or a bug fix in another session. Each run lives on its own feature branch in its own worktree with its own `.scratch/<slug>/`, so runs do not interfere. When a run finishes, review the feature branch as a whole. If something is missing, write the follow-up tickets and run the chain again on those.

### Why `/to-design` sits in front of it

Once every ticket is implemented by a different agent, nobody is holding the architecture. Each implementer would decide module boundaries, signatures and file layout for its own ticket, and ten tickets would produce ten opinions. `/to-design` settles that once, on the spec, before any ticket is cut: modules with real signatures, the file layout, the data, the wiring and the rules. `/to-tickets` reads it, `/to-workflow` copies it into the run, and every implementer and reviewer gets it pasted into their prompt.

### Why there are two executors

`/to-plan` and `/run-plan` came first. They run a plan of segments with scoped and barrier checkpoints, through an agent team that lives in one session: implementers, a review lead, lens reviewers, arbiters, a product owner, plus a git hook that blocks merges on red pipelines or open findings threads. It works, but it is heavy. It needs 36 generated agent stubs, and the review threads of a segment grew until a single session could no longer carry them. `/to-workflow` and `/run-workflow` are the rewrite: one ticket at a time, every agent a background agent, all state in git and in comments on the tickets, so a new session can pick up a run exactly where the last one stopped. Use the plan executor when you want live checkpoints and an interactive team; use the workflow executor for everything else.

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

Turns a spec from `/to-spec` into a concrete implementation design: a concept (module map, wiring, file layout) you read, then the modules with real signatures, data and rules that implementers build from. Grills you with sketched options, posts the design as a comment on the spec, saves it to `.scratch/<slug>/design.md` and mirrors it into the repo's architecture docs.

- **Input:** the spec (a `.scratch/<slug>/spec.md` path, an issue number or URL, or the one `/to-spec` produced in this session), plus `CONTEXT.md`, `docs/adr/`, `CODING_STANDARDS.md` and `ARCHITECTURE.md` when present.
- **Output:** a **Design** comment on the spec, the same text in `.scratch/<slug>/design.md`, and the docs moved to the intended state. The chat shows the concept once, at the confirmation gate; the signatures are read from the file.
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
- **Uses:** `code-review` and `tdd` from mattpocock/skills, `ponytail:ponytail` and `ponytail:ponytail-review` from the ponytail plugin, `security-review` from getsentry/skills.

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
- **Uses:** `tdd` from mattpocock/skills, `ponytail:ponytail` for the implementers and `ponytail:ponytail-review` for the simplicity lens.

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
