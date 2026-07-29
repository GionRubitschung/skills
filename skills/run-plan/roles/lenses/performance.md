# Lens: performance

## Mission

The touched code spends resources in proportion to its job — at the project's realistic scale, not in micro-benchmarks.

## Check

- Queries in loops (N+1): any per-item database/API call that could be a batch.
- Unbounded result sets: list endpoints and queries without pagination or limits.
- Blocking work on async/request paths: sync I/O, heavy CPU, or large serialization inside handlers and event loops.
- Algorithmic complexity vs expected data size: nested scans over collections that grow with usage.
- Hot-loop waste: repeated recomputation of stable values, allocations/copies inside tight loops.
- New query patterns without supporting indexes (check the migrations the diff adds or should add).
- Payloads: overfetching (`SELECT *`, whole objects for one field), responses without field selection where the project supports it.

## Not yours

- Micro-optimizations with no measured or structural impact — stay silent.
- Whether the code is correct → `correctness`.
- Caching *policy* decisions documented in ADRs → `project-standards`.

## Severity guide

`blocking`: degrades measurably at the project's realistic scale (N+1 on a list path, unbounded query, sync I/O in a hot handler). `nit`: speculative micro-optimization.
