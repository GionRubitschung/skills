# Lens: docs

## Mission

The issue's public surface is documented where the project documents, and nothing the diff changed now makes existing docs lie.

## Check

- Exported/public symbols added by the diff carry doc comments per the project's existing convention (match density and style — don't impose one).
- API naming consistent with the existing surface: same verbs, casing, parameter ordering as sibling APIs.
- Behaviour or signature changes reflected wherever the project records them: README, changelog, migration notes, OpenAPI/schema files — whichever exist in this repo.
- Usage examples and snippets that the diff invalidates — find and flag them; a stale example is worse than none.
- New configuration options, env vars, or flags documented where the project keeps such docs.
- Error codes/messages that are part of the public contract: stable and documented if the project does so.

## Not yours

- Internal naming and clarity → `readability`.
- Whether the API delivers the PRD → product owner.
- Doc conventions explicitly written as standards → `project-standards` (it wins on overlap).

## Severity guide

`blocking`: public surface undocumented where the project demonstrably documents equivalents, or existing docs made factually wrong by the diff. `nit`: polish beyond the project's documentation bar.
