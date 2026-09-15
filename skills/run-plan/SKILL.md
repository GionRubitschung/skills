---
name: run-plan
description: Execute a /to-plan implementation plan with an orchestrated agent team — DAG-scheduled parallel TDD implementation in isolated worktrees, a diverse-lens review panel with durable findings threads, a product-owner gate, and a git-hook merge gate that blocks on red pipelines or open threads. Use when the user wants to run an implementation plan, orchestrate parallel issue implementation across an agent team, or execute the output of /to-plan.
disable-model-invocation: true
---

# Run Plan

Execute a plan from `/to-plan`. This session is the **orchestrator** (team lead): it spawns teammates, routes messages, merges approved work, and owns all git topology. Implementers never spawn agents and never touch git topology; the review lead may spawn **read-only one-shots only** (lens panel, arbiters).

Read [LIFECYCLE.md](LIFECYCLE.md) for the findings-file format, the per-issue state machine, DAG dispatch, and the message protocol. Teammate role prompts are in `roles/`; the merge-gate hook template is `templates/pre-merge-commit.sh`.

## Model & effort

Every agent is spawned through an **agent-definition stub** in `~/.claude/agents/`, generated once by `scripts/generate-agent-stubs.sh` (36 stubs: 6 roles × inherit + 5 effort levels). The stub frontmatter carries the **effort**; the **model** is the Agent tool's `model` parameter; the role *content* stays in `roles/*.md`, whose absolute path you inject in the spawn prompt (the stub body just tells the agent to read it). Resolve each agent's pair before spawning:

- **Effort and model** each come from the issue's `Model/Effort` override if set, else the plan's **Agent models** role default, else `inherit`. `inherit` at any level falls through to the next; a fully-inherited agent uses the session's model and effort.
- **Role → stub base**: `rp-implementer`, `rp-review-lead`, `rp-lens-reviewer`, `rp-arbiter`, `rp-po`, `rp-triager`.
- **Spawn args**: `subagent_type: rp-<role>` when the effort resolves to `inherit`, else `rp-<role>-<effort>`; pass `model: <model>` unless it resolves to `inherit` (then omit the parameter).
- A per-issue `Model/Effort` override applies to that issue's **whole chain** — its implementer, review lead, lens panel, and arbiter (and the review chain of a `manual` issue). The review lead spawns the panel and arbiter itself, so inject their resolved (stub, model) into its context (section 5).

## 1. Preflight

- **Require** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. If unset, abort: tell the user to add it to the `env` block of `settings.json` and restart.
- **Require the agent stubs**. Check `~/.claude/agents/rp-implementer.md` exists and its `rp-stubs-version` marker matches the version in `scripts/generate-agent-stubs.sh`. If missing or stale, abort: tell the user to run `scripts/generate-agent-stubs.sh` and restart (agent definitions load only at session start, so a mid-session generation will not be picked up). This is unconditional — the team spawns through these stubs even for an all-`inherit` plan.
- **Validate the plan's model/effort config** against the catalog before spawning anything, since the plan is hand-editable. Every `Model` in the **Agent models** table and every `Model/Effort` cell must use `Model` ∈ {`sonnet`, `opus`, `haiku`, `fable`, `inherit`} and `Effort` ∈ {`low`, `medium`, `high`, `xhigh`, `max`, `inherit`}. Any other token aborts with the offending cell named — never spawn on an unvalidated plan (a typo must fail here, not hours into the run).
- Locate the plan: the argument is the plan path; if absent, scan `.scratch/*/plan.md` across `git worktree list` (this includes the main checkout) — one match wins, several → ask.
- Read the plan's `Baseline mode`. **worktree**: `cd` into the baseline worktree. **in-place**: the baseline is the current checkout — stay in it, and re-run the in-place soft guards (dirty tree, protected branch) before mutating anything, since time may have passed since `/to-plan`. Either way, all orchestration and merges happen in the baseline checkout.
- Parse the plan (format documented by `/to-plan`). Read the PRD reference and `docs/agents/issue-tracker.md`.
- **Reconcile**: for any issue not `pending`, check `git log <baseline>..<issue-branch>`, the findings file, and the test state to ground-truth its status against the plan file.
- If any issue is mid-flight, this is a resume — run the triage step (LIFECYCLE.md → Resume) before dispatching anything.
- **Install the merge gate**: copy `templates/pre-merge-commit.sh` to the repo's hook dir — `git config core.hooksPath` if set, else `git rev-parse --git-path hooks` — as `pre-merge-commit`, filling the placeholders (baseline branch, absolute `.scratch/<slug>` dir, one `run '<cmd>'` line per Quality then per Verify command). If a `pre-merge-commit` hook already exists, rename it to `pre-merge-commit.local` (the template chains to it). `chmod +x`. Nothing is ever installed beyond this plain shell script; never merge with `--no-verify`.
- State the cost: up to `cap` implementers + `cap` review leads + 1 PO live teammates, plus short-lived read-only one-shots (lens panels on review round 1, arbiters on disputes, triagers on resume). Call out any non-`inherit` model or effort — the role defaults from the **Agent models** table and each issue's `Model/Effort` override — so the user sees what the run will cost before it starts. Note too that the run **pauses at a review gate each time a segment completes** (and a final whole-project gate before teardown); review feedback there spawns remediation issues via `/to-issues` (section 6). Ask once to proceed.

## 2. Set up the team

- Call `TeamCreate`, named after the plan slug.
- Spawn the `po` teammate (`run_in_background: true`) on its resolved stub and model (`subagent_type`/`model` per **Model & effort** — the `po` row of the Agent models table) with `roles/product-owner.md` plus the PRD reference, the plan, and the findings-file path scheme. It is long-lived for the whole run.

## 3. Conduct the DAG

Work segment by segment, top to bottom. Within a segment, dispatch is **edge-driven**: maintain a ready-set — nodes whose blockers are all done — and act on it whenever a node completes:

- **Issue ready** + a free slot under the parallelism cap → start it (section 4). Several ready, fewer slots → take them in plan order.
- **Checkpoint ready** → set it `waiting`, print its instructions, and continue conducting everything that doesn't depend on it. When the user confirms done, mark `done` — its dependents become ready.
- **Barrier checkpoint** → same, but nothing beyond it is dispatched until it is `done`; the segment ends there, so its review gate (section 6) folds the checkpoint's manual-task instruction into the same prompt as the behavioral review.
- **Manual issue ready** → create its worktree and branch, copy the gitignored files in, and tell the user it is theirs; the run keeps flowing around them. When they say done, the issue enters the lifecycle at `in-review` (same panel, PO, and merge gate — findings are surfaced to the user via the orchestrator instead of an impl teammate).

A segment is done when every node in it is `merged`/`done`; **its review gate then fires (section 6) before the next segment dispatches** — the gate is barrier-like, so nothing past it starts until the user approves. Honour `status`, `pause`, and `abort` typed by the user at any time.

## 4. Start an issue

1. `git worktree add .claude/worktrees/issue-<n> -b feat/<slug>-issue-<n> <baseline-HEAD>`.
2. Copy the plan's "Copy into worktrees" files into the new worktree.
3. Spawn `impl-<n>` (`run_in_background: true`) on its resolved stub and model (per **Model & effort**: the issue's `Model/Effort` override if set, else the `implementer` role default) with `roles/implementer.md` and the injected context: issue number, worktree absolute path, branch names, verify + quality command(s), and the findings file path `.scratch/<slug>/findings-<n>.md`.

## 5. React to messages

The orchestrator is event-driven — teammate messages re-activate it. Handle each message per LIFECYCLE.md. Key routes:

- `READY` → spawn `review-lead-<n>` (background) on its resolved stub and model (per **Model & effort**: the issue's `Model/Effort` override if set, else the `review-lead` role default) with `roles/review-lead.md` and injected context: issue number, impl teammate name, branches, verify + quality commands, the findings file path, the issue's **lens set** from the plan, the review-round cap, the absolute path to this skill's `roles/` dir (lens catalog in `roles/lenses/`, one rules file per lens; arbiter and contract files alongside), and the **resolved lens-reviewer and arbiter spawn args** for this issue — each as a `subagent_type` stub name and a model (or "no model param" for inherit), since the lead spawns those one-shots itself. Same override resolution: for an issue with a `Model/Effort` override, all four roles in its chain resolve to it; otherwise each uses its own role default.
- `CLEAN` → message `po`: `REVIEW: <#> <branch>`.
- `APPROVED` → message `impl-<n>`: `INTEGRATE`.
- `INTEGRATED` → merge (section 7).
- `FEEDBACK` / `NOT-CONVERGING` / `BLOCKED` → per LIFECYCLE.md; any `BLOCKED` surfaces the question to the user, then relays the answer back and resumes that issue.

Update the plan file's status tokens as state changes — the plan file plus the findings files are the single source of truth and the resume point.

## 6. Review gate

When a segment's nodes are all `merged`/`done`, fire its **review gate** before dispatching the next segment — the human's behavioral / PRD-level review (the lens panel judged code quality; the PO judged per-issue conformance + integration). It is **barrier-like**: nothing past it dispatches until the user approves. Gates are implicit — `/to-plan` never authors them; record their state in the plan at runtime. Full state machine, brief contents, and plan-file format are in LIFECYCLE.md → **Review gates**.

1. **Present the behavioral brief** (no spawn) and set the gate `waiting` in the plan: each merged issue's intent + acceptance-criteria ticks, the segment diffstat, the demo + verify command(s), and findings-file pointers — then the two replies, `approve` or free-text changes. At a **barrier** checkpoint, fold its manual-task instruction into the same prompt; `done` then needs both the task confirmed and the review approved.
2. **`approve`** → mark the gate `done` and stamp the current baseline-HEAD into its `GATE` token as the boundary SHA (`GATE s<n> — done @<sha>`) — the teardown squash groups commits by these; re-evaluate the ready-set (next segment, or teardown).
3. **Changes** → set `changes-requested (round N)` and turn the feedback into work: run **`/to-issues`** (PRD-child issues with their own acceptance criteria), fold the result into the plan with a mini `/to-plan` pass (type → lens set, edges, model/effort; append to the Issues table with an origin marker `(review s<seg> r<N>)` and a sub-schedule block under the gate), branch each off the **current baseline-HEAD**, and dispatch through the normal lifecycle (section 4). These issues are **owned by this gate**. When the feedback is new scope, **offer** to amend the PRD body (opt-in; never automatic). The PO still judges each one against its own acceptance criteria + integration.
4. When **all** the gate's remediation issues are `merged`, **re-fire** the gate (back to step 1, re-presenting the updated segment). Loop until `approve`. After `review-max-rounds` human rounds on one gate, surface the **soft meta-prompt** — keep iterating / accept-as-is & proceed / abort — never a hard stop.

**At plan end**: fire the final segment's gate, then a separate **whole-project** review gate whose brief maps the PRD's acceptance criteria to the merged issues (full-baseline diffstat + demo/verify). Both must be `done` before teardown; each stamps its boundary SHA on approval like any gate (the whole-project gate contributes a squash commit only if it spawned remediation). A **single-segment** plan collapses these two into one gate.

## 7. Merge (serial, hook-gated)

Merge one issue at a time, in the baseline worktree: `git merge --no-ff feat/<slug>-issue-<n>`. The pre-merge-commit hook runs the gate on the actual merge candidate — quality commands, then the full verify suite(s), then a findings-file check; any open or disputed thread, or any red command, **aborts the merge**.

- Gate red → `git merge --abort` if needed, route the hook's output to the responsible party (`impl-<n>` for red pipeline, `review-lead-<n>` for open threads), and re-enter the lifecycle there. Never bypass with `--no-verify`.
- Gate green → update the plan (`merged`, tick the box), remove the worktree, stop `impl-<n>` and `review-lead-<n>`, then re-evaluate the ready-set (the merge may unblock dependents). Re-evaluation also checks whether this merge **completed a segment** (→ fire its review gate, section 6) or was the **last remediation issue of an open review gate** (→ re-fire that gate).

## 8. Teardown

When every segment is done and the final **whole-project review gate** is approved (section 6):

- **Remove the merge-gate hook**; restore a displaced `pre-merge-commit.local` to its original name if one exists.
- **Squash the history** per the plan's `Squash:` policy (LIFECYCLE.md → **Squash at teardown**), unless it is `none`. This is the last mutation of baseline: save a `<baseline>-pre-squash` backup ref at the current HEAD, then rebuild baseline with one synthesized commit per **approval boundary** (`per-segment`, the default), per merged issue (`per-issue`), or one for the whole plan (`whole-plan`) — `git commit-tree <boundary-tree> -p <prev>` chained, finished with a single `git update-ref` (atomic: a mid-squash failure leaves baseline unmoved). Each message is clean and synthesized — a conventional-commit subject + body describing the change with **no** orchestration scaffolding (no "segment N", no squash-count footer, no plan/slug refs), plus a `Closes #…` trailer for that boundary's issues; show each draft before committing. Record `Squashed: yes` in the plan so a resume never repeats it.
- Call `TeamDelete`. Remove any leftover worktrees with `git worktree remove`.
- Report: baseline branch, issues merged, the post-squash commit count, anything skipped or escalated.
- **Offer** to open the baseline→main merge request — do not create it unprompted.
- **Cleanup**: once the merge request is actually created, delete the issue branches and the `<baseline>-pre-squash` backup ref (recovery is then reflog only). If the user declines the MR, keep both this session. Findings files are always kept.

On `abort` or an unresolved escalation, stop but delete nothing except the hook and **do not squash** — the plan file, findings files, and worktrees stay for a later resume.
