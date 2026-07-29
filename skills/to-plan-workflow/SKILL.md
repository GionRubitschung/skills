---
name: to-plan-workflow
description: Turn a PRD's blocked-by issue graph into a segmented, dependency-DAG implementation plan for the fully-AFK /run-plan-workflow executor. Interviews the user to set scale mode and adversarial-review knobs, classify per-issue review lenses, and place blocking checkpoints. Use when the user wants to plan a hands-off, scale-out parallel implementation run driven by dynamic workflows (not an interactive agent team).
---

# To Plan (Workflow)

Produce a **segmented, dependency-DAG plan** that `/run-plan-workflow` executes **fully AFK** with dynamic workflows. This skill does the thinking and the interviewing — it spawns no agents and runs no workflow itself.

This is the workflow-executor sibling of `/to-plan`. Reach for `/to-plan` instead when the run needs live human-in-the-loop (interactive checkpoints, manual issues mid-run, real-time escalation). Use this when the goal is hands-off scale: kick it off and walk away.

The issue tracker and domain-doc layout should be present — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Preflight

- Read `docs/agents/issue-tracker.md` and `docs/agents/domain.md` (→ `CONTEXT.md`, ADRs).
- No agent-teams env var is needed — the executor uses dynamic workflows, not teams.

### 2. Gather the issues

The argument is a PRD issue reference or an explicit list of issue numbers. Reuse `/to-issues` context if it ran this session.

- Fetch the PRD and every child issue (issues whose `## Parent` references the PRD).
- Parse each `## Blocked by` block into a dependency graph; normalise to explicit issue-number edges — **these edges are the DAG the executor schedules on**.
- Detect cycles. If the graph has one, stop and show it — the user must fix the issues first.
- Note HITL issues. **Default every HITL issue to `escalate`** (an agent implements it; material judgement calls fail-and-report). Only mark an issue `manual` if the user insists on hand-writing it — a `manual` issue becomes a hard segment boundary.

### 3. Create the baseline worktree

Same as `/to-plan`: the baseline branch is the integration target every issue branches off and merges back into.

- Branch name `feat/<prd-slug>` (slug from the PRD title; type/slug overridable). Base ref = current `HEAD` — confirm (may be `main`/`develop`).
- `git worktree add .claude/worktrees/baseline -b feat/<prd-slug> <base>`. Add `.claude/worktrees/` to `.git/info/exclude` if not already excluded.
- If the branch or worktree path already exists, stop and ask: reuse / rename / abort. Never clobber.

### 4. Classify review lenses

For each issue, infer a **type** — `feature` | `refactor` | `bugfix` | `infra` — and assign its default **lens profile**:

| Type     | Default lenses                                                  |
| -------- | -------------------------------------------------------------- |
| feature  | correctness, project-standards, test-quality, readability       |
| refactor | correctness, project-standards, regression-risk, readability    |
| bugfix   | correctness, test-quality, readability                          |
| infra    | correctness, project-standards, security                        |

Add `security` to any issue touching auth, secrets, input handling, or external I/O. The panel judges **internal quality only** — the product-owner gate owns all integration concerns, so never add an "integration" lens.

### 5. Derive segments

- Topologically order the DAG. A **segment** is a maximal run of work containing **no blocking checkpoint and no `manual` issue**. Cut a new segment at every checkpoint and before the dependents of every `manual` issue.
- Within a segment there are **no phase barriers** — the executor schedules issues by their blocked-by edges directly (an issue starts the moment its blockers merge).
- Present the derived segments as the starting schedule.

### 6. Interview the user

Grill relentlessly to refine, one item at a time. Dependency edges are hard — never place a blocked issue before its blocker. Walk this checklist:

1. **Segment shape** — confirm/insert/move blocking checkpoints (migrations, infra, sign-off) and `manual` issues; everything between is AFK.
2. **Scale mode** — `capped` (fixed knobs + optional budget ceiling) or `unbounded` (loop-until-dry adversarial review; best paired with ultracode).
3. **Review knobs** — review-max-rounds (capped only, default 5), panel-refuters per finding (default 3, majority rules), po-panel size (default 1), dry-rounds (unbounded, default 2), optional budget ceiling in tokens.
4. **Per-issue lenses** — show each issue's default profile; let the user add or drop lenses.
5. **Per-issue context** — gotchas or preferred approach not captured in the issue text.
6. **Verify command(s)** — how agents run the test suite; auto-detect, then confirm. May be several (e.g. a monorepo's backend and frontend).
7. **Gitignored files agents need** — paths like `.env` to copy into each worktree.
8. **Squash policy** — how `/run-plan-workflow` flattens the noisy per-issue commit history at teardown: `per-segment` (default — one clean commit per segment), `per-issue` (one per merged issue), `whole-plan` (a single commit), or `none` (keep the raw `--no-ff` history). Present the default; adjust on objection. Validate the value against that set — any other token is a hard stop.

There is no parallelism-cap question — the workflow runtime caps concurrency itself — and no between-phase gating question — the run is AFK.

### 7. Write the plan

Write the plan to `.scratch/<prd-slug>/plan-workflow.md` inside the baseline worktree, using [PLAN-WORKFLOW-FORMAT.md](PLAN-WORKFLOW-FORMAT.md). Do not commit it — it is a transient artifact and the executor's resume point.

### 8. Hand off

Tell the user the plan path, invite them to review and edit it directly, and tell them to run `/run-plan-workflow <plan-path>`. If they chose `unbounded`, remind them ultracode is recommended.
