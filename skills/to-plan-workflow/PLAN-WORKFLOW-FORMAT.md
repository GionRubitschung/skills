# Plan File Format — Workflow Executor

`/to-plan-workflow` writes this file; `/run-plan-workflow` reads it and mutates the status tokens as it runs. It lives at `.scratch/<prd-slug>/plan-workflow.md` inside the baseline worktree and is **not committed**. It is the durable resume point — reconciled against git on every (re)start.

## Template

```
# Implementation Plan (Workflow): <PRD title>

## Meta

- PRD: <issue reference or URL>
- Baseline branch: feat/<slug>
- Base ref: <branch or sha>
- Worktree root: .claude/worktrees/
- Scale mode: capped                                      # capped | unbounded
- Knobs: review-max-rounds=5, panel-refuters=3, po-panel=1, dry-rounds=2, budget-ceiling=—
- Verify: <command>                                       # may list several (backend / frontend)
- Copy into worktrees: .env                               # gitignored paths agents need; "—" if none
- Squash: per-segment                                     # teardown history: per-issue | per-segment | whole-plan | none

## Issues

| #   | Title            | Type     | Blocked by | HITL     | Lens set                                                             | Notes        |
| --- | ---------------- | -------- | ---------- | -------- | ------------------------------------------------------------------- | ------------ |
| 12  | Create db models | infra    | —          | —        | correctness, project-standards, security                            |              |
| 13  | Auth backend     | feature  | 12         | escalate | correctness, project-standards, test-quality, readability, security |              |
| 14  | Frontend sign-in | feature  | 12         | —        | correctness, project-standards, test-quality, readability           | writes to db |
| 15  | Wire auth calls  | feature  | 13, 14     | —        | correctness, project-standards, test-quality, readability           |              |

## Schedule

### Segment 1

DAG over: #12 → (#13, #14) → #15

- [ ] #12 — pending
- [ ] #13 — pending
- [ ] #14 — pending
- [ ] #15 — pending

### Checkpoint (boundary)

Run the database migration manually, then continue:
<command or instructions>

### Segment 2

DAG over: #16 → #17

- [ ] #16 — pending
- [ ] #17 — pending
```

## Field notes

- **Type** drives the default lens profile; **Lens set** is the final per-issue set the executor runs verbatim. The panel judges internal quality only — the product-owner gate owns all integration.
- **HITL**: `—` (AFK), `escalate` (agent implements; material blockers fail-and-report), or `manual` (human hand-writes at the boundary; forces a segment cut before its dependents).
- **Scale mode** `unbounded` ignores `review-max-rounds` and instead loops adversarial review until `dry-rounds` consecutive empty rounds; pair with ultracode. `budget-ceiling`, if set, hard-caps total token spend.
- A **Segment** runs as one dynamic workflow; issues inside it schedule by their blocked-by edges with no phase barrier. Boundaries (checkpoints / `manual` issues) are handled interactively by the `/run-plan-workflow` session between segments.
- **Squash** sets how `/run-plan-workflow` flattens the noisy per-issue commit history **at teardown**, once every segment is `merged` (skipped entirely if any issue is `failed`/`skipped` or a `segmentVerify` halt fired): `per-segment` (default — one clean commit per segment), `per-issue` (one per merged issue), `whole-plan` (a single commit), or `none` (keep the raw `--no-ff` history). The mechanism mirrors `/run-plan` (see the `run-plan` skill's LIFECYCLE.md → **Squash at teardown**); the conductor records each segment's boundary SHA and a `Squashed: yes` marker at runtime.

## Boundary / step types

- **Segment** — one workflow call; a dependency-DAG of issues, fully AFK.
- **Checkpoint** — a manual-intervention pause between segments; the executor prints the text and waits.
- **Manual issue** — a `manual`-HITL issue; the executor sets up its worktree, the user writes the code, and it passes the same panel + PO bar interactively before merge.

## Status values

The executor updates each issue's status token in place:

`pending` → `in-progress` → `in-review` → `po-review` → `merged`

Terminal non-merged states: `failed: <reason>` and `skipped: <blocker>` (a blocker failed — transitive cascade). Tick the checkbox when an issue reaches `merged`.
