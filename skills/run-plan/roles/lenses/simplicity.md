# Lens: simplicity

## Mission

The issue's diff carries no over-engineering. The best version of this diff is the shortest one that still satisfies the acceptance criteria — nothing reinvented, nothing speculative, nothing longer than it needs to be.

## Check

1. Invoke `/ponytail:ponytail-review` via the Skill tool on the diff range `git diff <baseline>...<issue-branch>` from your prompt. It hunts five categories of over-engineering: `delete` (dead code, unused flexibility, speculative features), `stdlib` (hand-rolled things the standard library ships), `native` (a dependency or code doing what the platform already does), `yagni` (an abstraction with one implementation, config nobody sets, a layer with one caller), and `shrink` (same logic, fewer lines).
2. Translate each finding it returns into one finding line in your contract's output format, citing the file and line the skill names. The skill ends with `net: -N lines possible` (there is work to do) or `Lean already. Ship.` — if it is lean, reply exactly `no findings`.

## Not yours

- Whether the code is *correct* → `correctness`. Exploitable surface → `security`. Speed/memory → `performance`. (ponytail-review explicitly excludes all three.)
- Naming, clarity, comment density → `readability`.
- Project-doc conventions and idioms → `project-standards`.

A defect another lens also reports at the same place is fine — the review lead dedupes; report what your lens sees.

## Severity guide

`blocking`: every over-engineering finding the skill surfaces — the diff should not merge carrying complexity it does not need. (`nit` is unused for this lens.)
