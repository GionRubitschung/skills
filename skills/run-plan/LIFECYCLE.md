# Per-Issue Lifecycle & Message Protocol

## Message protocol

Teammates and the orchestrator coordinate with `SendMessage`. Every message starts with a signal token so the orchestrator can route it. The role prompts instruct teammates to use these exact tokens.

| From → To             | Signal                 | Meaning                                          |
| --------------------- | ---------------------- | ------------------------------------------------ |
| impl → orchestrator   | `READY`                | `/tdd` finished; branch ready for code review    |
| impl → orchestrator   | `INTEGRATED`           | branch brought up to baseline, verify passes     |
| impl → orchestrator   | `BLOCKED: <question>`  | genuine blocker; needs a human decision          |
| review → impl         | `FINDINGS: <list>`     | blocking findings to fix                         |
| impl → review         | `FIXED`                | findings addressed; please re-review             |
| review → orchestrator | `CLEAN`                | no blocking findings remain                      |
| review → orchestrator | `NOT-CONVERGING: <…>`  | review-round cap hit; findings still open        |
| orchestrator → po     | `REVIEW: <#> <branch>` | review this issue against the PRD                |
| po → orchestrator     | `APPROVED: <#>`        | meets the PRD and integrates cleanly             |
| po → orchestrator     | `FEEDBACK: <#> <list>` | PRD or integration problems to fix               |
| orchestrator → impl   | `FEEDBACK: <list>`     | reviewer or PO feedback; re-enter the loop       |
| orchestrator → impl   | `INTEGRATE`            | bring branch up to baseline tip, resolve, verify |

## State machine (one issue)

```
pending
  │  orchestrator creates worktree + branch, spawns impl-<n>
  ▼
in-progress ── impl runs /tdd issue-driven ──► READY
  ▼
in-review
  │  orchestrator spawns review-<n>; review-<n> ↔ impl-<n> loop:
  │    FINDINGS → FIXED → re-review …   (max <review cap> rounds)
  │  cap exceeded → NOT-CONVERGING → escalate to user
  ▼  CLEAN
po-review
  │  orchestrator → po: REVIEW
  │  FEEDBACK → orchestrator → impl-<n> FEEDBACK → back to in-review
  │           (max <review cap> PO rounds → escalate to user)
  ▼  APPROVED
integrate
  │  orchestrator → impl-<n>: INTEGRATE
  │  impl merges baseline in, resolves conflicts, runs verify
  │  conflict it cannot resolve → BLOCKED → escalate
  │  verify red → fix → re-verify
  ▼  INTEGRATED
merged
     orchestrator merges --no-ff into baseline, updates the plan,
     removes the worktree, stops impl-<n> and review-<n>
```

## Rules

- **One `review-<n>` per issue**, kept alive across the whole quality loop and any PO-triggered re-loop, so it re-reviews with full context. Stopped at `merged`.
- The quality loop and the PO loop each cap at the plan's review-max-rounds. On exceeding, escalate the open findings to the user rather than looping forever.
- **Code review judges quality only** (project standards, tests, readability). **PO judges PRD conformance plus integration** with already-merged work. Never merge the two concerns.
- **Merges are serial** — the orchestrator merges one issue at a time.
- **Lazy integration** — a branch is brought up to baseline exactly once, at `integrate`, just before its own merge. In-flight agents are never interrupted to rebase. This is safe because issues within a phase are dependency-independent by construction.
- **Tests are a hard gate** — an issue cannot reach `merged` unless the verify command passes on the integrated branch.

## Escalation

Any `BLOCKED` message pauses that issue (`status: blocked`), surfaces the question to the user, and waits. The rest of the phase continues. When the user answers, relay it to the agent and resume the issue.

## Resume

When the plan passed in has any non-`pending` issues, this is a resumed run:

- `merged` → skip; the baseline already has it.
- `pending` → dispatch normally.
- `in-progress` / `in-review` / `po-review` → the branch exists with partial commits. Default: re-spawn `impl-<n>` on the existing branch with a "continue from these commits" prompt, then re-enter the lifecycle at the reconciled state. The user may instead choose restart-all or decide per issue at preflight.

Teammates from the dead session are gone — always create a fresh team and re-spawn the roles needed.
