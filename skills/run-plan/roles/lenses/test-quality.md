# Lens: test-quality

## Mission

The tests prove the acceptance criteria as observable behaviour, and the suite is green.

## Check

- Run the verify command(s). A red suite is a blocking finding — report it and still review the rest.
- Every acceptance criterion of the issue has a test that exercises it as behaviour; map them explicitly.
- Tests assert observable behaviour, not implementation internals: over-mocking that pins the structure, assertions on private state, tests that would survive the behaviour breaking.
- A test must be able to fail: no tautologies, no asserting the mock you just configured.
- Failure paths tested, not just happy paths — errors, rejections, empty results.
- Determinism: no sleeps, real network, wall-clock time, or unseeded randomness.
- New branches and error paths in the diff are actually exercised.
- Test names describe the behaviour under test; fixtures and helpers follow the project's existing test conventions.

## Not yours

- Whether the tested behaviour is the *right* behaviour per the PRD → product owner.
- Bugs in the production code itself → `correctness`.
- Deleted or weakened *pre-existing* tests → `regression-risk`.

## Severity guide

`blocking`: red suite, an acceptance criterion without a behaviour test, or a test that cannot fail / tests only internals. `nit`: naming or organisation polish.
