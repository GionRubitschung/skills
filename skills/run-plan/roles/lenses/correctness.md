# Lens: correctness

## Mission

The issue's own code does what it claims, for every input it can actually receive.

## Check

- Logic against the acceptance criteria: does each implemented behaviour actually hold, or only on the happy path?
- Edge inputs: empty, null/undefined, zero, negative, duplicate, unicode, very large — for every parameter the diff introduces or rewires.
- Boundaries: off-by-one in loops, ranges, slicing, pagination math.
- Error handling: failures surfaced, not swallowed; catch blocks that hide the cause; error paths that leave state half-mutated.
- Async: unawaited promises, missing cancellation, results assumed ordered.
- Shared state: races on anything the diff reads-then-writes that another caller can touch concurrently.
- Resources: handles, connections, listeners, temp files opened in the diff and not reliably released.
- Types and conversions: lossy casts, implicit coercion, timezone/precision traps in date and number handling.

## Not yours

- Missing or weak tests → `test-quality`.
- Pre-existing behaviour the diff may have changed elsewhere → `regression-risk`.
- Exploitability of an input-handling flaw → `security`.
- Naming, structure, clarity → `readability` / `project-standards`.

## Severity guide

`blocking`: produces wrong results, crashes, hangs, or corrupts state on an input a real caller can send. `nit`: a theoretical edge no current caller can reach.
