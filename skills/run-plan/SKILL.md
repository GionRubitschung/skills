---
name: run-plan
description: Execute a /to-plan implementation plan with an orchestrated agent team — parallel TDD implementation in isolated worktrees, code-quality review loops, product-owner review against the PRD, and merge into the baseline branch. Use when the user wants to run an implementation plan, orchestrate parallel issue implementation across an agent team, or execute the output of /to-plan.
---

# Run Plan

Execute a plan from `/to-plan`. This session is the **orchestrator** (team lead): it spawns teammates, routes messages, merges approved work, and owns all git topology. Teammates never spawn agents and never touch git topology.

Read [LIFECYCLE.md](LIFECYCLE.md) for the per-issue state machine and the message protocol. The three teammate role prompts are in `roles/` in this skill's directory.

## 1. Preflight

- **Require** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. If unset, abort: tell the user to add it to the `env` block of `settings.json` and restart.
- Locate the plan: the argument is the plan path; if absent, find the baseline worktree via `git worktree list` and scan `.scratch/*/plan.md` — one match wins, several → ask.
- `cd` into the baseline worktree; all orchestration and merges happen there.
- Parse the plan (format documented by `/to-plan`). Read the PRD reference and `docs/agents/issue-tracker.md`.
- **Reconcile**: for any issue not `pending`, check `git log <baseline>..<issue-branch>` and the test state to ground-truth its status against the plan file.
- If any issue is mid-flight, this is a resume — report the in-flight set and ask resume-all / restart-all / decide per issue (LIFECYCLE.md → Resume).
- State the cost: up to `cap + 1 PO + cap reviewers` parallel Claude Code sessions, high token use. Ask once to proceed.

## 2. Set up the team

- Call `TeamCreate`, named after the plan slug.
- Spawn the `po` teammate (`subagent_type: general-purpose`, `run_in_background: true`) with `roles/product-owner.md` plus the PRD reference and the plan. It is long-lived for the whole run.

## 3. Execute steps in order

Walk the schedule top to bottom. For each step:

- **Checkpoint** → print the text, wait for the user to confirm done, continue.
- **Phase** → run it (section 4).

After each phase, if gating is `pause`, stop for the user's OK before the next step. Honour `status`, `pause`, and `abort` typed by the user at any time.

## 4. Run a phase

Spawn implementation agents up to the parallelism cap; split a wider phase into serial sub-batches. For each issue:

1. `git worktree add .claude/worktrees/issue-<n> -b feat/<slug>-issue-<n> <baseline-HEAD>`.
2. Copy the plan's "Copy into worktrees" files into the new worktree.
3. Spawn `impl-<n>` (`general-purpose`, `run_in_background: true`) with `roles/implementer.md` and the injected context: issue number, worktree absolute path, branch names, verify command(s).
4. For a `manual` HITL issue, skip the agent — tell the user to implement it in the worktree, wait for done, then enter it into the lifecycle at the review stage.

Drive each issue through its lifecycle (LIFECYCLE.md) by reacting to teammate messages. The phase is complete when every issue in it is `merged`.

## 5. React to messages

The orchestrator is event-driven — teammate messages re-activate it. Handle each message per LIFECYCLE.md: `READY`, `CLEAN`, `NOT-CONVERGING`, `APPROVED`, `FEEDBACK`, `BLOCKED`, `INTEGRATED`. Update the plan file's status tokens as state changes — the plan file is the single source of truth and the resume point.

Any `BLOCKED` message → surface the question to the user, relay the answer back to the agent, resume that issue.

## 6. Teardown

When every step is done:

- Call `TeamDelete`. Remove any leftover worktrees with `git worktree remove`; keep the issue branches.
- Report: baseline branch, issues merged, anything skipped or escalated.
- Offer to open the baseline→main merge request — do not create it unprompted.

On `abort` or an unresolved escalation, stop but delete nothing — the plan file and worktrees stay for a later resume.
