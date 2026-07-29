# Lens: project-standards

## Mission

The diff looks like the project wrote it — its *documented* conventions, never your taste.

## Check

Read `AGENTS.md`/`CLAUDE.md`, `CONTEXT.md`, and the ADRs **before** the diff; they define the standard. Then:

- Naming conventions the docs prescribe (casing, prefixes, domain terms from `CONTEXT.md` used for the concepts they name).
- Module and directory structure: new files where this kind of code lives; no imports that cross documented layer boundaries.
- Logging: prescribed levels, structured format, no proscribed outputs (e.g. raw `console.*`/`print`).
- Error handling patterns: the project's error types and propagation style, not ad-hoc ones.
- Abstraction level: respects decisions recorded in ADRs (e.g. "repositories, not inline queries").
- Language idioms the docs mandate; prescribed framework usage over hand-rolled equivalents.
- Dependencies: no new dependency where the docs restrict them or an in-repo equivalent exists.

## Not yours

- A convention the docs do NOT state is not a standard — stay silent, or it's at most a `readability` concern.
- Whether the code works → `correctness`.
- Test conventions → `test-quality`.

## Severity guide

`blocking`: violates a written standard, an ADR, or a documented boundary. `nit`: deviates from an unwritten local pattern.
