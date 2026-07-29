# Lens: readability

## Mission

The next maintainer can follow the diff without the author in the room.

## Check

- Names say what things are or do; a misleading name is worse than a vague one.
- Functions do one thing; nesting stays shallow; control flow is followable top-to-bottom (early returns over arrow-shaped code).
- Comments state only what the code cannot: non-obvious constraints, the *why*. Flag both directions — a missing why on genuinely surprising code, and noise comments narrating the obvious.
- Comment density and idiom match the surrounding code.
- No dead code, commented-out blocks, or leftover debug output.
- Magic values named; duplicated logic that obscures the shared intent.
- Side effects live where the name promises them — nothing surprising hidden in an innocuous-looking call.

## Not yours

- Conventions written in the project docs → `project-standards`.
- Whether the code is correct → `correctness`.
- Public API documentation → `docs`.

## Severity guide

`blocking`: a competent reader would *misunderstand* what the code does — misleading name, hidden side effect, comment that lies. `nit`: could be marginally clearer.
