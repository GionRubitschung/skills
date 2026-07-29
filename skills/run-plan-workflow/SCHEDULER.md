# Segment Workflow — Engine Spec

`segment-workflow.js` executes ONE segment as a dependency-DAG, fully AFK. The conductor (`SKILL.md`) invokes it once per segment via `Workflow({ scriptPath, args })`. The script is a **pure function of `args`** — it does no git itself (agents do) and uses no `Date.now`/`Math.random` — so the same `args` reproduce the same run and `runId` resume cache-hits cleanly.

## `args` contract

```
{
  baselineBranch, worktreeRoot, slug,
  agentsDir,                 // absolute path to this skill's agents/ dir
  verify,                    // string | string[]  (full-suite command(s))
  copyFiles,                 // gitignored paths to copy into each worktree
  prdRef, prdText,           // PRD pre-fetched by the conductor (agents do not refetch)
  issueTracker,              // path to docs/agents/issue-tracker.md
  mode,                      // 'capped' | 'unbounded'
  knobs: { reviewMaxRounds, panelRefuters, poPanel, dryRounds, budgetCeiling? },
  issues: [ { n, title, type, blockedBy:[n...], lensSet:[...], hitl, notes } ],
  done:    [ n... ],                                          // resume: already merged
  inFlight:[ { n, branch, triage:{ action, reEnterAt } } ],  // resume
}
```

## Scheduling semantics

- One **promise per issue** (`P[n]`), resolving to its `IssueResult` (it never rejects → clean cascade). Already-merged issues (`args.done`) are pre-resolved.
- An issue task **awaits all its blockers' promises**. If any blocker outcome ≠ `merged`, it resolves itself `skipped` (transitive cascade) and spawns nothing.
- All issue tasks launch at once; the runtime caps concurrent `agent()` calls and drains the queue automatically.
- **Merge-lock**: a single chained promise serialises the integrate → delta-check → merge critical section, so only one writer touches baseline at a time while everything else runs in parallel.

## Per-issue pipeline

1. **Implement** — `agents/implementer.md` via `/tdd`, in a fresh `git worktree` off **live baseline-tip**. On resume, continue-from-commits or skip to review per the triage decision.
2. **Review (mode-tied loop)** — `agents/reviewer-lens.md` once per lens in `lensSet` (in parallel) → pool + dedupe blocking findings → `agents/finding-verifier.md` × `panel-refuters` per finding, majority-real survives → implementer fixes confirmed findings.
   - **capped**: subsequent rounds re-check fixed findings + a regression sweep; stop at a clean round or `reviewMaxRounds` (→ `failed: review-not-converging`).
   - **unbounded**: full panel + an open-ended hunter lens re-run every round until `dryRounds` consecutive empty rounds.
3. **PO gate** — `agents/product-owner.md` (× `poPanel`, majority) judges PRD conformance + integration vs current baseline. Reject → fix-loop (capped at `reviewMaxRounds` → `failed: po-not-converging`).
4. **Pre-verify (off-lock, parallel)** — an agent runs the full `verify` on the branch. Red → `failed: verify-red`.
5. **Merge (serial, in-lock)** — `agents/integrator.md` integrates baseline-tip, runs a fast delta/smoke check, `--no-ff` merges. Unresolvable conflict → `failed` (+ openQuestion).
6. Resolve `P[n] = merged`, unblocking dependents.

## Segment-end gate

After all issue tasks settle, one agent runs the full `verify` on baseline. Red ⇒ `segmentVerify: 'red'` (a cross-issue interaction) — the conductor halts before the next segment.

## Schemas (agent structured output)

```
FINDINGS_SCHEMA  { findings: [ { lens, severity:'blocking'|'nit', file, line?, summary, rationale } ] }
VERDICT_SCHEMA   { real:boolean, confidence, reason }
PO_SCHEMA        { approved:boolean, prdGaps:[...], integrationConflicts:[...] }
VERIFY_SCHEMA    { green:boolean, summary }
MERGE_SCHEMA     { merged:boolean, branch, sha?, reason?, openQuestion? }
TRIAGE_SCHEMA    { issue, action:'continue'|'restart', reEnterAt:'impl'|'review', why }
```

## `SegmentResult` (return value)

```
{ merged:[n...],
  failed:[{issue,reason,openQuestion?}],
  skipped:[{issue,blockedBy}],
  openQuestions:[{issue,question}],
  segmentVerify:'green'|'red' }
```

## Determinism & budget

- No `Date.now` / `Math.random`; label agents by issue number; keep prompts stable so `runId` resume cache-hits.
- If a token budget is in effect, the unbounded loop also stops when `budget.remaining()` runs low and `log()`s what it dropped — never silently truncate.

## Risks to validate (build-time)

1. The promise-graph scheduler + merge-lock + cascade — prototype on a toy 3–4 issue DAG, including a kill mid-segment and a `runId` resume.
2. Confirm a `segmentVerify: 'red'` report makes the culprit issue-pair findable.
3. Workflow-agent cwd: agents must `cd` into the right worktree explicitly; the baseline branch lives in the baseline worktree.
