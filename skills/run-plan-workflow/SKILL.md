---
name: run-plan-workflow
description: Execute a /to-plan-workflow plan fully AFK with dynamic workflows — a thin conductor that runs each segment as a dependency-DAG workflow (parallel TDD implementation, adversarial diverse-lens review, product-owner gate, serial merges), isolates and reports failures, and stops only at blocking checkpoints. Use when the user wants a hands-off, scale-out, deterministic plan run driven by workflows instead of an interactive agent team.
---

# Run Plan (Workflow)

Execute a `plan-workflow.md` from `/to-plan-workflow` **fully AFK**. This session is a **thin conductor**: it owns git topology *between* segments, runs each segment as one dynamic **workflow**, isolates failures, and stops only at blocking checkpoints. The per-segment engine, the `args` contract, and the schemas live in [SCHEDULER.md](SCHEDULER.md); the workflow itself is [segment-workflow.js](segment-workflow.js); the agent prompts are in `agents/`.

This is the workflow sibling of `/run-plan`. It trades live human-in-the-loop for hands-off scale and determinism. Decisions it cannot make autonomously are **not** escalated mid-run — they fail-and-report for you to resolve and resume.

## 1. Preflight

- Locate the plan: the argument is the plan path; if absent, find the baseline worktree (`git worktree list`) and scan `.scratch/*/plan-workflow.md` — one match wins, several → ask.
- `cd` into the baseline worktree; all conducting and merges anchor there.
- Parse the plan (per PLAN-WORKFLOW-FORMAT.md). Read the PRD reference and `docs/agents/issue-tracker.md`. **Pre-fetch the PRD body once** — it is passed to every segment as `args.prdText` so agents never refetch it.
- **Reconcile** against git: for each issue, classify `merged` (branch already in baseline via `git log <baseline>..`), `in-flight` (branch exists with un-merged commits), or `pending`. This — not the plan tokens alone — is ground truth.
- If anything is in-flight, this is a **resume** (section 5).
- State the cost: fully-AFK, up to the runtime concurrency cap of parallel Claude Code agents per segment, high token use; `unbounded` mode is open-ended (loop-until-dry). Ultracode recommended for `unbounded`. **Ask once to proceed.**

## 2. Conduct the segments

Walk the schedule top to bottom. For each entry:

- **Segment** → run it (section 3).
- **Checkpoint** → print the text, wait for the user to confirm done, continue.
- **Manual issue** → interactive gate (section 4).

Honour `status`, `pause`, and `abort` typed by the user at any time.

## 3. Run a segment

Invoke the workflow:

- `Workflow({ scriptPath: "<this skill dir>/segment-workflow.js", args })`. Build `args` per SCHEDULER.md from the plan: `baselineBranch`, `worktreeRoot`, `slug`, `agentsDir` (absolute path to this skill's `agents/`), `verify`, `copyFiles`, `prdRef`, `prdText`, `issueTracker`, `mode`, `knobs`, `issues` (with edges + lens sets), plus the resume sets `done` and `inFlight`.
- The workflow runs in the background; you are notified on completion. It returns a `SegmentResult`.
- On return:
  - Persist it to the plan file: set each issue token to `merged` / `failed: <reason>` / `skipped: <blocker>`; tick merged boxes. Record the current baseline-HEAD as this segment's **boundary SHA** (the teardown squash groups by these).
  - **Clean up**: `git worktree remove` each merged issue's worktree (keep the branch). **Keep failed/skipped worktrees** for inspection.
  - If `segmentVerify` is `red` (a cross-issue interaction broke the suite), **halt**: do not start the next segment; report the segment's diff and the failing suite, and stop for the user. Baseline must be green before building on it.
- A segment is done when its `SegmentResult` is persisted and `segmentVerify` is green.

## 4. Manual-issue boundary

For a `manual` issue:

1. `git worktree add .claude/worktrees/issue-<n> -b feat/<slug>-issue-<n> <baseline-tip>`; copy the plan's gitignored files in.
2. Tell the user to implement it there; wait for done.
3. Run the **same bar** on their branch — a single-issue mini-review using the `agents/` panel + product-owner (a one-off `Workflow` over just this issue entering at the review stage) — and surface findings to the user (they are the author); iterate until clean.
4. `git merge --no-ff` into baseline; record `merged`. Continue.

## 5. Resume

A run with any in-flight issues is a resume:

- `merged` issues → pass their numbers in `args.done`; the scheduler resolves them instantly without re-running.
- `in-flight` issues → run the **triager** (`agents/triager.md`) on each branch; it returns a `TriageDecision` (continue-from-commits + where to re-enter, or restart). Write the decisions into the plan file and pass them in `args.inFlight`.
- `pending` → scheduled normally.
- Within a *live* session, a killed segment-workflow can instead be resumed by its `runId` (cached agent calls return instantly) — prefer that when available; fall back to the git reconcile above across sessions.

## 6. Teardown

When every segment is done:

- **Squash the history** per the plan's `Squash:` policy, unless it is `none` — or **any** issue is `failed`/`skipped` or a `segmentVerify` halt fired, in which case skip the squash entirely and report. The mechanism mirrors `/run-plan`'s teardown squash (run-plan/LIFECYCLE.md → **Squash at teardown**): save a `<baseline>-pre-squash` backup ref at the current HEAD, then rebuild baseline with one synthesized commit per **segment** (`per-segment`, default), per merged issue (`per-issue`), or one for the whole plan (`whole-plan`) — `git commit-tree <boundary-tree> -p <prev>` chained, finished with a single `git update-ref` (atomic). A segment's boundary is the baseline-HEAD recorded when its `SegmentResult` was persisted (section 3). Messages are clean, synthesized, scaffolding-free, with a `Closes #…` trailer; being fully AFK, write them directly (no draft preview). Record `Squashed: yes` in the plan so a resume never repeats it.
- Report: baseline branch, issues `merged` / `failed` (+ reasons + open questions) / `skipped` (+ blocker), the post-squash commit count, and any `segmentVerify` halt.
- Remove leftover merged worktrees with `git worktree remove`; keep any failed/skipped worktrees.
- Offer to open the baseline→main merge request — do **not** create it unprompted.
- **Cleanup**: once the merge request is actually created, delete the issue branches and the `<baseline>-pre-squash` backup ref (recovery is then reflog only). If the MR is declined, keep both this session. Findings/segment artifacts are kept.

On `abort`, an unresolved `failed`/`skipped` set, or a `segmentVerify` halt, stop but delete nothing and **do not squash** — the plan file, branches, and worktrees stay for a later resume.
