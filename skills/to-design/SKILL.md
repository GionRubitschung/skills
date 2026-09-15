---
name: to-design
description: Turn a spec from /to-spec into a fully concrete implementation design — modules with real signatures, file layout, data, wiring, rules — posted as a comment on the spec and mirrored into the repo's architecture docs, so /to-tickets, /to-workflow and /run-workflow build it the way you want.
disable-model-invocation: true
---

# To Design

Decide HOW a spec gets built before an implementer decides it for you. The result is a **design**: one comment on the spec, fully concrete, in the template at the end of this file, plus the repo docs moved to the intended state. Downstream, `/to-tickets` sees the design because it reads the spec's comments, `/to-workflow` copies the last design into `workflow.json`, and `/run-workflow` pastes it into every implementer and reviewer prompt. Optional in the chain: grill → spec → tickets works without it; run it any time after `/to-spec`.

The issue tracker should have been provided (the `## Agent skills` section of CLAUDE.md) — run `/setup-matt-pocock-skills` if not. Invoke the Skill tool for `codebase-design` and for `domain-modeling` now: **module, interface, seam, adapter, depth, locality** and the CONTEXT.md terms are the only vocabulary the design is written in.

## 1. Gather

- **The spec**: the argument is a `.scratch/<slug>/spec.md` path, an issue number or a URL; with no argument, the spec `/to-spec` produced in this session. Read its full body and every comment, the way `docs/agents/issue-tracker.md` says to fetch a ticket.
- **The docs**, each skipped silently when missing: `CONTEXT.md` (or the contexts `CONTEXT-MAP.md` points at), `docs/adr/`, `CODING_STANDARDS.md`, `ARCHITECTURE.md`.
- **Existing tickets** for this spec: `.scratch/<slug>/issues/`, or the issues that reference the spec.
- **The code**: the entry points and modules the spec's Implementation Decisions name, the tests its Testing Decisions cite as prior art, and everything the design will have to call or change.
- **Mode**: when the spec already carries a comment whose first bold word is **Design**, ask the user which mode they want and wait: **amend** — the last design is the draft and step 2 is skipped — or **fresh** — the full draft, because the code or the spec moved too far for an amendment. The choice is theirs every time.

**Done when:** spec, docs, tickets and touched code are read, and the mode is known.

## 2. Draft (fresh mode)

Design it twice, once, at feature level: the pattern in `codebase-design`'s `DESIGN-IT-TWICE.md`, applied to the whole feature's module set instead of one module.

1. **Frame the problem space** for the user: the constraints any design must satisfy, the dependencies with their category from `DEEPENING.md`, and a sketch that makes the constraints concrete. Show it, then continue without waiting.
2. **Spawn three general-purpose sub-agents in parallel**, a fourth when the feature touches an external system. Same brief for all, one constraint each:
   - minimise the interface: one to three entry points per module, maximum leverage per entry point;
   - maximise flexibility: many use cases, room for extension;
   - optimise for the most common caller: the default case is trivial;
   - (external system only) ports and adapters at every cross-seam dependency.

   The brief carries the spec, the docs read in step 1, the design template below, the `codebase-design` glossary, the paths of the code read in step 1 and its constraint. Each agent returns one complete design in the template as its final text and nothing else.
3. **Present and compare**: show the designs one after the other, then compare them in prose by depth, locality and seam placement, and recommend one design or a hybrid. Be opinionated.

**Done when:** the user has seen every design and the recommendation.

## 3. Grill

Run the `/grilling` skill over the draft, one question at a time, the recommended design's choice as the default answer of every question. The frontier, in order: every point where the designs diverge; every section of the template still unsettled; each Rule. While grilling:

- `/domain-modeling` stays active: a module named after a concept missing from `CONTEXT.md` gets the term added on the spot; a decision that is hard to reverse, surprising without context and a real trade-off gets an ADR offer.
- An answer that holds for every feature, not just this one, is a **standing rule**: offer to append it to `CODING_STANDARDS.md`, creating the file with that first rule when it is missing. Answers specific to this feature go into the design's Rules.
- In amend mode the frontier is the change the user asked for plus whatever the spec or the touched code changed since the last design was posted.
- On request, run design-it-twice again on one module the user names.

**Done when:** every section of the template is settled and the user confirms the design.

## 4. Publish

1. **Post the design** as a comment on the spec, with the tracker's post recipe (local tracker: append under `## Comments` in `spec.md`). The comment starts with the line `> *Posted by /to-design.*`, a blank line, then `**Design** v<n>` where n is one more than the highest version already on the spec. Earlier design comments stay untouched; the last one wins.
2. **Update `ARCHITECTURE.md`** to the intended state: the modules the design adds, changes or removes, in the map format below. Create it when missing, holding only the modules this design touches.
3. **Apply the remaining doc edits**: any accepted standing rule, CONTEXT.md term or ADR not written during the grilling.
4. **Existing tickets**: name every ticket that no longer fits the design — a prefactoring the tickets lack, a slice that cuts across a module — with a one-line reason each. Rerunning `/to-tickets` is the user's call.
5. **Hand off** with every doc edit left uncommitted: list the files to commit (they must be on the base ref before `/to-workflow` creates the baseline, and `/to-workflow` refuses to run while they are not), then the next command — `/to-tickets <spec>` when no tickets exist, otherwise `/to-workflow`.

**Done when:** the comment is posted, the docs are edited, the hand-off message is sent.

## Design template

Fully concrete: real paths, real signatures and type shapes in the project's language, real names. The whole comment is pasted into every implementer prompt, so it holds what an implementer needs to build it as designed and nothing else.

```markdown
> *Posted by /to-design.*

**Design** v1

## Modules
### <Module name>            (one block per new or changed module)
Where: <paths>
Owns: <the behaviour behind this interface, in CONTEXT.md vocabulary>
Interface:
    <actual signatures or type shapes, in the project's language>
Reuses: <existing modules or helpers it must call instead of reimplementing>
Tests: <the seam its tests cross, and the file that is prior art>

## Data
<schema changes, persisted shapes, wire formats>

## Wiring
<who calls whom; the existing entry points that change; the order things happen in>

## File layout
<tree of new and changed files>

## Rules
<feature-specific do and don't list: patterns to use, things not to introduce,
 dependencies allowed or forbidden>

## Prefactoring
<changes to existing code that must land before the feature; each becomes a ticket>
```

## ARCHITECTURE.md format

The map of the codebase as it is meant to be after the current design: one block per module, grouped by layer, in the same vocabulary as the design.

```markdown
# Architecture

<one paragraph: the shape of the codebase — layers, entry points, how a request flows>

## <Layer or area>

### <Module name>
Where: <path>
Owns: <the behaviour behind its interface>
Interface: <entry points, one line each>
Depends on: <modules and external systems, with the seam type from DEEPENING.md>
```
