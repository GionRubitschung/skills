export const meta = {
  name: 'run-plan-workflow-segment',
  description: 'Execute one plan segment as a dependency-DAG: TDD implementation, adversarial diverse-lens review, product-owner gate, serial merges — fully AFK.',
  phases: [
    { title: 'Implement' },
    { title: 'Review' },
    { title: 'Merge' },
    { title: 'Segment gate' },
  ],
}

// ────────────────────────────── schemas ──────────────────────────────
const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['lens', 'severity', 'summary'],
        properties: {
          lens: { type: 'string' },
          severity: { type: 'string', enum: ['blocking', 'nit'] },
          file: { type: 'string' },
          line: { type: 'number' },
          summary: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
  },
}
const VERDICT_SCHEMA = {
  type: 'object',
  required: ['real', 'reason'],
  properties: { real: { type: 'boolean' }, confidence: { type: 'number' }, reason: { type: 'string' } },
}
const PO_SCHEMA = {
  type: 'object',
  required: ['approved'],
  properties: {
    approved: { type: 'boolean' },
    prdGaps: { type: 'array', items: { type: 'string' } },
    integrationConflicts: { type: 'array', items: { type: 'string' } },
  },
}
const VERIFY_SCHEMA = {
  type: 'object',
  required: ['green'],
  properties: { green: { type: 'boolean' }, summary: { type: 'string' } },
}
const MERGE_SCHEMA = {
  type: 'object',
  required: ['merged'],
  properties: {
    merged: { type: 'boolean' },
    branch: { type: 'string' },
    sha: { type: 'string' },
    reason: { type: 'string' },
    openQuestion: { type: 'string' },
  },
}

// ────────────────────────────── helpers ──────────────────────────────
// Some harnesses thread `args` to a scriptPath workflow as a JSON string
// rather than a parsed object; accept either.
const A = typeof args === 'string' ? JSON.parse(args) : args
const k = A.knobs || {}
const dir = A.agentsDir
const verifyCmd = [].concat(A.verify || []).join('  |  ')
const branchOf = (i) => `feat/${A.slug}-issue-${i.n}`
const worktreeOf = (i) => `${A.worktreeRoot}/issue-${i.n}`
const range = (n) => Array.from({ length: n }, (_, j) => j)

const ctx = (i) =>
  [
    `Issue #${i.n}: ${i.title}`,
    `Worktree: ${worktreeOf(i)}   Branch: ${branchOf(i)}   Baseline: ${A.baselineBranch}`,
    `Verify: ${verifyCmd}`,
    i.notes ? `Notes: ${i.notes}` : '',
    `Issue-tracker doc: ${A.issueTracker}`,
  ]
    .filter(Boolean)
    .join('\n')

function dedupe(findings) {
  const seen = new Set()
  const out = []
  for (const f of findings) {
    const key = `${f.file || ''}:${f.line || ''}:${f.summary}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(f)
    }
  }
  return out
}

// ─────────────────────────── promise graph ───────────────────────────
const settle = new Map() // n -> resolve fn
const result = new Map() // n -> IssueResult
const P = new Map() // n -> Promise<IssueResult>
for (const i of A.issues) {
  let r
  P.set(i.n, new Promise((res) => { r = res }))
  settle.set(i.n, (v) => { result.set(i.n, v); r(v) })
}
for (const n of A.done || []) if (settle.has(n)) settle.get(n)({ issue: n, outcome: 'merged', resumed: true })

// ─────────────────────────── serial merge-lock ───────────────────────
let mergeChain = Promise.resolve()
function critical(fn) {
  const r = mergeChain.then(fn)
  mergeChain = r.then(() => {}, () => {}) // swallow so the chain survives a failed merge
  return r
}

// ─────────────────────────── review round ────────────────────────────
async function reviewRound(i, round) {
  const base = i.lensSet || []
  const lenses =
    A.mode === 'capped' && round > 0 ? ['regression-risk'] : A.mode === 'unbounded' ? base.concat(['hunter']) : base

  const reviews = await parallel(
    lenses.map((lens) => () =>
      agent(
        `Read ${dir}/reviewer-lens.md and review issue #${i.n} through the "${lens}" lens ONLY (internal quality; integration is the product owner's job). Review \`git diff ${A.baselineBranch}...${branchOf(i)}\`.\n${ctx(i)}`,
        { label: `review:${lens}#${i.n}`, phase: 'Review', schema: FINDINGS_SCHEMA },
      ),
    ),
  )
  const blocking = dedupe(
    reviews.filter(Boolean).flatMap((r) => r.findings || []).filter((f) => f.severity === 'blocking'),
  )

  const verdicts = await parallel(
    blocking.map((f) => () =>
      parallel(
        range(k.panelRefuters || 3).map(() => () =>
          agent(
            `Read ${dir}/finding-verifier.md. Try to REFUTE this candidate blocking finding on issue #${i.n} (default real=false if uncertain): ${JSON.stringify(f)}\n${ctx(i)}`,
            { label: `verify-finding#${i.n}`, phase: 'Review', schema: VERDICT_SCHEMA },
          ),
        ),
      ).then((vs) => {
        const v = vs.filter(Boolean)
        return { f, real: v.filter((x) => x.real).length > v.length / 2 }
      }),
    ),
  )
  return verdicts.filter((v) => v.real).map((v) => v.f)
}

// ──────────────────────────── one issue ──────────────────────────────
async function runIssue(i) {
  if (result.has(i.n)) return result.get(i.n)
  const fin = (v) => { settle.get(i.n)(v); return v }

  // 1. gate on blockers (cascade-skip on any dead blocker). Cross-segment
  //    blockers aren't in this segment's promise map — the conductor only
  //    launches a segment after all prior segments merged, so they're satisfied.
  const blockers = await Promise.all((i.blockedBy || []).filter((b) => P.has(b)).map((b) => P.get(b)))
  const dead = blockers.find((r) => r.outcome !== 'merged')
  if (dead) return fin({ issue: i.n, outcome: 'skipped', blockedBy: dead.issue })

  const fly = (A.inFlight || []).find((f) => f.n === i.n)
  try {
    // 2. implement (or continue / skip per resume triage)
    if (!(fly && fly.triage && fly.triage.reEnterAt === 'review')) {
      const continueNote = fly
        ? 'CONTINUE from the existing commits on the branch — do not restart.'
        : 'Create the worktree off live baseline-tip first.'
      await agent(
        `Read ${dir}/implementer.md and implement issue #${i.n} test-first via /tdd, non-interactively. ${continueNote}\nCopy these gitignored paths into the worktree: ${[].concat(A.copyFiles || []).join(', ') || '—'}\n${ctx(i)}`,
        { label: `impl#${i.n}`, phase: 'Implement' },
      )
    }

    // 3. review loop (mode-tied)
    let round = 0
    let dry = 0
    let lastOpen = []
    while (true) {
      const open = await reviewRound(i, round)
      if (open.length === 0) {
        if (A.mode === 'unbounded') {
          if (++dry >= (k.dryRounds || 2)) break
          if (budget.total && budget.remaining() < 50000) { log(`#${i.n}: budget low, ending review early`); break }
        } else break
      } else {
        dry = 0
        lastOpen = open
        await agent(
          `Read ${dir}/implementer.md (review-loop section). Fix these CONFIRMED blocking findings on issue #${i.n}, commit, re-run verify: ${JSON.stringify(open)}\n${ctx(i)}`,
          { label: `fix#${i.n}`, phase: 'Review' },
        )
      }
      round++
      if (A.mode === 'capped' && round >= (k.reviewMaxRounds || 5) && lastOpen.length)
        return fin({ issue: i.n, outcome: 'failed', reason: 'review-not-converging', openQuestion: JSON.stringify(lastOpen) })
    }

    // 4. product-owner gate (PRD + integration)
    const poPrompt = `Read ${dir}/product-owner.md. Judge issue #${i.n} for PRD conformance + integration against the current ${A.baselineBranch}. PRD body:\n${A.prdText}\n${ctx(i)}`
    let po = await agent(poPrompt, { label: `po#${i.n}`, phase: 'Review', schema: PO_SCHEMA })
    let poRound = 0
    while (!po.approved) {
      await agent(
        `Read ${dir}/implementer.md (review-loop section). Address this product-owner feedback on issue #${i.n}, commit, re-run verify: ${JSON.stringify(po)}\n${ctx(i)}`,
        { label: `po-fix#${i.n}`, phase: 'Review' },
      )
      if (++poRound >= (k.reviewMaxRounds || 5))
        return fin({ issue: i.n, outcome: 'failed', reason: 'po-not-converging', openQuestion: JSON.stringify(po) })
      po = await agent(poPrompt, { label: `po#${i.n}`, phase: 'Review', schema: PO_SCHEMA })
    }

    // 5. full pre-verify (off the merge-lock, runs in parallel with other issues)
    const pre = await agent(
      `Read ${dir}/integrator.md (pre-verify section). Run the full verify on branch ${branchOf(i)} WITHOUT integrating baseline yet.\n${ctx(i)}`,
      { label: `verify#${i.n}`, phase: 'Merge', schema: VERIFY_SCHEMA },
    )
    if (!pre.green) return fin({ issue: i.n, outcome: 'failed', reason: 'verify-red', openQuestion: pre.summary })

    // 6. serial critical section: integrate baseline-tip → delta-check → --no-ff merge
    const m = await critical(() =>
      agent(
        `Read ${dir}/integrator.md (integrate+merge section). SERIALLY: merge the live tip of ${A.baselineBranch} into ${branchOf(i)}, run a fast delta/smoke check, then \`git merge --no-ff\` ${branchOf(i)} into ${A.baselineBranch}. If a conflict is genuinely beyond safe resolution, return merged:false with a reason.\n${ctx(i)}`,
        { label: `merge#${i.n}`, phase: 'Merge', schema: MERGE_SCHEMA },
      ),
    )
    if (!m.merged) return fin({ issue: i.n, outcome: 'failed', reason: m.reason || 'merge-failed', openQuestion: m.openQuestion })
    return fin({ issue: i.n, outcome: 'merged', branch: m.branch || branchOf(i), mergedSha: m.sha, reviewRounds: round })
  } catch (e) {
    return fin({ issue: i.n, outcome: 'failed', reason: 'exception', openQuestion: String(e) })
  }
}

// ──────────────────────────────── drive ──────────────────────────────
log(`Segment: ${A.issues.length} issues · mode=${A.mode} · ${(A.done || []).length} pre-merged`)
const results = await Promise.all(A.issues.map(runIssue))

const gate = await agent(
  `Read ${dir}/integrator.md (segment-gate section). Run the full verify on ${A.baselineBranch} as the segment-end gate. Name the most likely culprit files if it is red.`,
  { label: 'segment-gate', phase: 'Segment gate', schema: VERIFY_SCHEMA },
)

return {
  merged: results.filter((r) => r.outcome === 'merged').map((r) => r.issue),
  failed: results
    .filter((r) => r.outcome === 'failed')
    .map((r) => ({ issue: r.issue, reason: r.reason, openQuestion: r.openQuestion })),
  skipped: results.filter((r) => r.outcome === 'skipped').map((r) => ({ issue: r.issue, blockedBy: r.blockedBy })),
  openQuestions: results.filter((r) => r.openQuestion).map((r) => ({ issue: r.issue, question: r.openQuestion })),
  segmentVerify: gate && gate.green ? 'green' : 'red',
}
