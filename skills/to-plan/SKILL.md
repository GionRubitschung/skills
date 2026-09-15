---
name: to-plan
description: Turn a PRD's blocked-by issue graph into a segmented, dependency-DAG implementation plan with per-issue review lenses, and create the baseline worktree it executes against. Interviews the user to place checkpoints (scoped or barrier) and capture HITL decisions. Use when the user wants to plan parallel implementation of a set of issues, schedule multi-issue work for an agent team, or prepare a plan for /run-plan.
disable-model-invocation: true
---

# To Plan

Produce a segmented, dependency-DAG implementation plan that `/run-plan` executes with an agent team. This skill does the thinking and the interviewing — it spawns no agents itself.

The issue tracker and domain-doc layout should have been provided — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Preflight

- Check the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable. If it is not `1`, warn the user: planning is fine, but `/run-plan` needs it — they must add `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` to the `env` block of `settings.json` and restart. Continue regardless.
- Check the agent-definition stubs exist: `ls ~/.claude/agents/rp-implementer.md`. If missing, warn the user: planning is fine, but `/run-plan` spawns its team through these stubs — before running they must execute the sibling `run-plan` skill's `scripts/generate-agent-stubs.sh` once and restart (agent definitions load at session start). Continue regardless. Only relevant if they intend to set non-`inherit` models or efforts; an all-`inherit` plan still benefits because `/run-plan` requires the stubs unconditionally.
- Read `docs/agents/issue-tracker.md` and `docs/agents/domain.md` (→ `CONTEXT.md`, ADRs).

### 2. Gather the issues

The argument is a PRD issue reference or an explicit list of issue numbers. If `/to-issues` ran earlier in this session, reuse that context instead of refetching.

- Fetch the PRD and every child issue (issues whose `## Parent` references the PRD).
- Parse each `## Blocked by` block into a dependency graph; normalise it to explicit issue-number edges — **these edges are the schedule**: `/run-plan` dispatches an issue the moment its blockers are done. There are no phase barriers.
- Detect cycles. If the graph has one, stop and show it — the user must fix the issues first.
- Infer each issue's **type**: `feature` | `refactor` | `bugfix` | `infra`.
- Note which issues are HITL vs AFK (from the `/to-issues` HITL marking or the triage label).

### 3. Create the baseline

The baseline is the integration target — every issue branches off it and merges back into it. Ask the user which mode (default **worktree**).

**Worktree** (default) — an isolated throwaway branch; the cwd is never touched.

- Branch name: `feat/<prd-slug>` (slug from the PRD title; type and slug overridable by the user).
- Base ref: the current `HEAD`. Confirm with the user — they may want `main`/`develop`.
- Run `git worktree add .claude/worktrees/baseline -b feat/<prd-slug> <base>`.
- If the branch or the worktree path already exists, stop and ask: reuse / rename / abort. Never clobber.
- Records `Baseline mode: worktree`, `Baseline branch: feat/<prd-slug>`, `Base ref: <base>`.

**In-place** — use the current branch in the cwd as the baseline; no new branch, no baseline worktree. Per-issue worktrees are still created, so parallelism is unchanged — only the baseline loses its worktree. `/run-plan` will merge issues into, and at teardown squash-rewrite the history of, **this** branch. Two **soft guards** — warn and require an explicit confirmation, then proceed (no auto-stash, no auto-branch):

- the current branch is `main`/`master`/`develop` or the repo default (`git symbolic-ref refs/remotes/origin/HEAD`);
- the working tree is dirty (`git status --porcelain`).

- Records `Baseline mode: in-place`, `Baseline branch: <current branch>`, `Base ref: —`.

Both modes: add `.claude/worktrees/` and `.scratch/` to `.git/info/exclude` if not already excluded.

### 4. Classify review lenses

Each issue's type sets its default **lens profile** — the panel `/run-plan`'s review lead runs on round 1:

| Type     | Default lenses                                                           |
| -------- | ------------------------------------------------------------------------ |
| feature  | correctness, project-standards, test-quality, readability, simplicity    |
| refactor | correctness, project-standards, regression-risk, readability, simplicity |
| bugfix   | correctness, test-quality, readability, simplicity                       |
| infra    | correctness, project-standards, security, simplicity                     |

Add `security` to any issue touching auth, secrets, input handling, or external I/O. The panel judges **internal quality only** — the product owner owns all integration concerns, so never add an "integration" lens.

The catalog is the files in the sibling `run-plan` skill's `roles/lenses/` directory — one precise ruleset per lens. Beyond the defaults above it ships `performance`, `accessibility`, and `docs`; assign those explicitly when an issue warrants them (never by default). **Validate every lens set against the catalog** — a name without a file is a typo or a custom lens the user must first add as a four-section file (Mission / Check / Not yours / Severity guide) in that directory.

Do not interview per issue. Present the classification once, as part of showing the schedule (step 6), and adjust only what the user objects to.

### 5. Derive the DAG and segments

- **Checkpoints are DAG nodes.** Each manual intervention (migration, secret rotation, infra action, manual verification) becomes a node `C<i>` with its own `blocked-by` edges, and blocks only the issues that list it. A checkpoint marked **barrier** blocks everything scheduled after it — use barriers for stop-the-world sign-offs only.
- A **segment** is the maximal stretch of the DAG between barrier checkpoints. Scoped (non-barrier) checkpoints live *inside* segments without cutting them.
- `manual` HITL issues are ordinary DAG nodes — the human is the implementer; nothing else stalls.
- Re-check for cycles with checkpoint edges included. Present the derived segments and DAG as the starting schedule.

### 6. Interview the user

Grill relentlessly to refine the schedule, one item at a time. Dependency edges are hard — never place a blocked node before its blocker. Walk this checklist:

1. **Checkpoints** — capture every manual intervention as a node: what must be done, what it is blocked by, what it blocks. Barrier or scoped? Default scoped; recommend barrier only for sign-offs that genuinely gate everything.
2. **HITL issues** — for each HITL issue, pick `manual` (the human implements it, in parallel, against the same review bar) or `escalate` (an agent implements it and escalates the judgement calls).
3. **Parallelism cap** — max concurrent implementation agents (default 3).
4. **Agent models & effort** — present the six-row **Agent models** table (implementer, review-lead, lens-reviewer, arbiter, po, triager) once, every row at `inherit/inherit`; adjust only what the user changes. Validate **strictly**, exactly like the lens catalog: `Model` ∈ {`sonnet`, `opus`, `haiku`, `fable`, `inherit`}, `Effort` ∈ {`low`, `medium`, `high`, `xhigh`, `max`, `inherit`}. Any other value is a hard stop — surface it, do not write it (a new alias means editing this enum and regenerating the stubs). Per-issue overrides go in the Issues table's **Model/Effort** column (same enums, validated the same way); capture them alongside per-issue context in item 6.
5. **Lens sets** — show the classification table from step 4 once; adjust on objection.
6. **Per-issue context** — gotchas or preferred approach not captured in the issue text; the per-issue **Model/Effort** override (item 4) if any.
7. **Verify command(s)** — the test suite(s); auto-detect, then confirm.
8. **Quality command(s)** — lint / typecheck / format-check; auto-detect (e.g. `eslint`, `tsc --noEmit`, `ruff`, `golangci-lint`), then confirm. "—" if the repo has none; never install tooling.
9. **Gitignored files agents need** — paths like `.env` to copy into each worktree.
10. **Review-loop cap** — max review rounds before escalation (default 5).
11. **Squash policy** — how `/run-plan` flattens the noisy per-issue commit history at teardown: `per-segment` (default — one clean commit per approved segment), `per-issue` (one per merged issue), `whole-plan` (a single commit), or `none` (keep the raw `--no-ff` history). Present the default; adjust on objection. Validate the value against that set — any other token is a hard stop.

There is no between-phase gating question — the run pauses at checkpoints; the user can always type `pause`/`status`/`abort` live.

### 7. Write the plan

Write the plan to `.scratch/<prd-slug>/plan.md` inside the baseline worktree, using the structure in [PLAN-FORMAT.md](PLAN-FORMAT.md). Do not commit it — it is a transient artifact.

### 8. Hand off

Tell the user the plan path, invite them to review and edit it directly, and tell them to run `/run-plan <plan-path>` to execute it.
