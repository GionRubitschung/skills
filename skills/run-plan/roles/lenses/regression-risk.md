# Lens: regression-risk

## Mission

Behaviour that existed before the diff still holds — or its change is intended by the issue and guarded by a test.

## Check

- Enumerate every behaviour the diff *changes* (not adds): modified conditions, branches, defaults, return values. For each: is the change mandated by the issue, and does a test now pin it?
- Public signatures and contracts: search for call sites *outside* the diff of anything whose signature, semantics, or error behaviour changed.
- Deleted, skipped, or weakened pre-existing tests — each one is a guarded behaviour someone un-guarded; demand the why.
- Data compatibility: changed serialization formats, schema/config changes, migrations — what happens to data written by the old code?
- Implicit contracts callers may rely on: ordering, timezone, locale, rounding/precision, ID formats.
- Removed code: was anything still depending on it (search, don't assume)?

## Not yours

- Bugs in newly *added* behaviour → `correctness`.
- Whether the new behaviour matches the PRD → product owner.

## Severity guide

`blocking`: an existing behaviour changed with no guarding test and no issue mandate, or a caller outside the diff now breaks. `nit`: theoretical compatibility concern with no known caller.
