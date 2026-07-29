# Plan File Format

`/to-plan` writes this file; `/run-plan` reads it and mutates the status tokens as it runs. It lives at `.scratch/<prd-slug>/plan.md` inside the baseline worktree and is **not committed**. Together with the per-issue findings files (`findings-<n>.md`, format owned by `/run-plan`), it is the durable resume point.

## Template

```
# Implementation Plan: <PRD title>

## Meta

- PRD: <issue reference or URL>
- Baseline mode: worktree            # worktree (isolated feat/<slug>) | in-place (current branch, in the cwd)
- Baseline branch: feat/<slug>
- Base ref: <branch or sha>          # "—" when Baseline mode is in-place (nothing was branched)
- Worktree root: .claude/worktrees/
- Parallelism cap: 3
- Review max rounds: 5
- Verify: <command>                    # full test suite(s); may list several, e.g. backend / frontend
- Quality: <command>                   # lint / typecheck / format-check; "—" if none
- Copy into worktrees: .env            # gitignored paths agents need; "—" if none
- Squash: per-segment                  # teardown history granularity: per-issue | per-segment | whole-plan | none

### Agent models

Per-role model and effort defaults. `inherit` = the orchestrator's session model / effort (the default for every row — the whole table is opt-in). `Model` ∈ `sonnet`, `opus`, `haiku`, `fable`, `inherit`. `Effort` ∈ `low`, `medium`, `high`, `xhigh`, `max`, `inherit`.

| Role          | Model   | Effort  |
| ------------- | ------- | ------- |
| implementer   | inherit | inherit |
| review-lead   | inherit | inherit |
| lens-reviewer | inherit | inherit |
| arbiter       | inherit | inherit |
| po            | inherit | inherit |
| triager       | inherit | inherit |

## Issues

| #   | Title             | Type    | Blocked by | HITL     | Model/Effort | Lens set                                                             | Notes        |
| --- | ----------------- | ------- | ---------- | -------- | ------------ | -------------------------------------------------------------------- | ------------ |
| 12  | Create db models  | infra   | —          | —        | —            | correctness, project-standards, security                              |              |
| 13  | Auth backend      | feature | 12, C1     | —        | opus/xhigh   | correctness, project-standards, test-quality, readability, security   |              |
| 14  | Frontend sign-in  | feature | 12, C1     | escalate | —            | correctness, project-standards, test-quality, readability             | writes to db |
| 15  | Wire auth calls   | feature | 13, 14     | —        | /high        | correctness, project-standards, test-quality, readability             |              |
| 16  | Audit log viewer  | feature | —          | manual   | haiku        | correctness, project-standards, test-quality, readability             |              |

## Checkpoints

| ID  | Blocked by | Barrier | Instructions                                       |
| --- | ---------- | ------- | -------------------------------------------------- |
| C1  | 12         | no      | Run the db migration manually: <command>           |
| C2  | 15, 16     | yes     | Sign off the staging deploy before continuing      |

## Schedule

### Segment 1

DAG: #12 → C1 → (#13, #14) → #15 · #16 independent (manual)

- [ ] #12 — pending
- [ ] C1 — pending
- [ ] #13 — pending
- [ ] #14 — pending
- [ ] #15 — pending
- [ ] #16 — pending

### C2 — barrier

Sign off the staging deploy, then continue.

### Segment 2

DAG: #17 → #18

- [ ] #17 — pending
- [ ] #18 — pending
```

## Field notes

- **Baseline mode** picks where the integration target lives. `worktree` (default) creates an isolated `feat/<slug>` branch in `.claude/worktrees/baseline`; the cwd is untouched. `in-place` uses the current branch in the cwd — no new branch, no baseline worktree — so `/run-plan` merges into and squash-rewrites **that** branch (the `<branch>-pre-squash` backup ref + reflog are the undo). Per-issue worktrees are created in both modes; only the baseline differs.
- **Blocked by** edges ARE the schedule: `/run-plan` dispatches a node the moment all its blockers are done, subject to the parallelism cap. No phase barriers exist. Edges may reference issues (`13`) and checkpoints (`C1`).
- **Type** drives the default lens profile; **Lens set** is the final per-issue panel the review lead runs verbatim on round 1. Every lens name must have a rules file in the `run-plan` skill's `roles/lenses/` catalog. The panel judges internal quality only — the product owner owns all integration.
- **HITL** is `—` for AFK issues, `escalate` (agent implements; judgement calls escalate live) or `manual` (the human implements it as an ordinary DAG node, against the same review bar).
- **Model/Effort** is a per-issue override applied to that issue's **whole chain** — implementer, review lead, lens panel, and arbiter (and the review chain of a `manual` issue). Forms: `model/effort` (`opus/xhigh`), `model` alone (`opus`), `/effort` alone (`/high`), or `—` for none. Each part validates against the same enums as the **Agent models** table. Resolution precedence per agent: **issue override → role default → session** (`inherit` at any level falls through to the next). `/run-plan` maps the resolved pair to a spawn: `subagent_type: rp-<role>[-<effort>]` (no suffix when the effort resolves to `inherit`) plus the `model` tool parameter (omitted when the model resolves to `inherit`). Effort rides the agent-definition stub's frontmatter; an effort level the chosen model does not support silently falls back to the highest it does.
- **Verify** may hold several commands (e.g. a monorepo's backend and frontend suites); implementers run the one(s) relevant to the files they touched. The merge gate runs all of them.
- **Quality** commands always run in full — by implementers before `READY` and by the merge gate (before Verify, fail-fast).
- **Notes** carries the per-issue context captured in the interview.
- **Squash** sets how `/run-plan` flattens the noisy per-issue commit history **at teardown**, after the whole-project gate is approved: `per-segment` (default — one clean synthesized commit per approved segment), `per-issue` (one per merged issue), `whole-plan` (a single commit), or `none` (keep the raw `--no-ff` history). Value validated against that set, exactly like the lens catalog. `/run-plan` owns the mechanism and adds runtime markers (`GATE … @<sha>` boundary SHAs, `Squashed: yes`) — see the sibling `run-plan` skill's LIFECYCLE.md → **Squash at teardown**.

## Node types

- **Issue** — implemented in an isolated worktree, reviewed, PO-gated, merged. The unit of parallel work.
- **Checkpoint (scoped)** — a manual intervention that dams only its dependents; everything else keeps flowing while the user acts.
- **Checkpoint (barrier)** — stop-the-world: cuts a segment; nothing scheduled after it starts until the user confirms done.
- **Manual issue** — HITL mode `manual`; the worktree is prepared when it unblocks, the human implements at their own pace, then it enters the normal review lifecycle.

## Status values

`/run-plan` updates each node's status token in place.

Issues: `pending` → `in-progress` → `in-review` → `po-review` → `merged`. `blocked` marks an issue waiting on a human escalation. Tick the checkbox at `merged`.

Checkpoints: `pending` → `waiting` (blockers done, instructions surfaced to the user) → `done`. Tick the checkbox at `done`.
