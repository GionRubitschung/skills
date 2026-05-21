---
name: to-plan
description: Turn a PRD's blocked-by issue graph into a phased, parallel implementation plan and create the baseline worktree it executes against. Interviews the user to schedule the work and capture manual-intervention checkpoints. Use when the user wants to plan parallel implementation of a set of issues, schedule multi-issue work for an agent team, or prepare a plan for /run-plan.
---

# To Plan

Produce a phased implementation plan that `/run-plan` executes with an agent team. This skill does the thinking and the interviewing — it spawns no agents itself.

The issue tracker and domain-doc layout should have been provided — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Preflight

- Check the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable. If it is not `1`, warn the user: planning is fine, but `/run-plan` needs it — they must add `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` to the `env` block of `settings.json` and restart. Continue regardless.
- Read `docs/agents/issue-tracker.md` and `docs/agents/domain.md` (→ `CONTEXT.md`, ADRs).

### 2. Gather the issues

The argument is a PRD issue reference or an explicit list of issue numbers. If `/to-issues` ran earlier in this session, reuse that context instead of refetching.

- Fetch the PRD and every child issue (issues whose `## Parent` references the PRD).
- Parse each `## Blocked by` block into a dependency graph; normalise it to explicit issue-number edges.
- Detect cycles. If the graph has one, stop and show it — the user must fix the issues first.
- Note which issues are HITL vs AFK (from the `/to-issues` HITL marking or the triage label).

### 3. Create the baseline worktree

The baseline branch is the integration target — every issue branches off it and merges back into it.

- Branch name: `feat/<prd-slug>` (slug from the PRD title; type and slug overridable by the user).
- Base ref: the current `HEAD`. Confirm with the user — they may want `main`/`develop`.
- Run `git worktree add .claude/worktrees/baseline -b feat/<prd-slug> <base>`.
- Add `.claude/worktrees/` to `.git/info/exclude` if not already excluded.
- If the branch or the worktree path already exists, stop and ask: reuse / rename / abort. Never clobber.

### 4. Derive the schedule

Topologically levelize the graph: a phase is the set of issues whose blockers all sit in earlier phases. Present the derived phases as the starting schedule.

### 5. Interview the user

Grill relentlessly to refine the schedule, one item at a time. Dependency edges are hard — never place a blocked issue before its blocker — but the user may make the schedule more serial. Walk this checklist:

1. **Schedule shape** — split a too-wide phase, merge thin ones, reorder within constraints.
2. **Parallelism cap** — max concurrent implementation agents (default 3). A phase wider than the cap is split into serial sub-batches.
3. **Manual-intervention checkpoints** — human actions between phases: migrations, secret rotation, infra, deploys, sign-off.
4. **HITL issues** — for each HITL issue, pick `manual` (the human writes the code) or `escalate` (an agent implements it and escalates the judgement calls).
5. **Per-issue context** — gotchas or preferred approach not captured in the issue text.
6. **Verify command(s)** — how agents run the test suite; auto-detect, then confirm.
7. **Between-phase gating** — pause for the user after each phase (default) or auto-continue.
8. **Gitignored files agents need** — paths like `.env` to copy into each worktree.
9. **Review-loop cap** — max code-review rounds before escalation (default 5).

### 6. Write the plan

Write the plan to `.scratch/<prd-slug>/plan.md` inside the baseline worktree, using the structure in [PLAN-FORMAT.md](PLAN-FORMAT.md). Do not commit it — it is a transient artifact.

### 7. Hand off

Tell the user the plan path, invite them to review and edit it directly, and tell them to run `/run-plan <plan-path>` to execute it.
