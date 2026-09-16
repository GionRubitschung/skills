---
name: to-design
description: Turn a spec from /to-spec into a concrete implementation design — a concept (module map, wiring, file layout) you read, and the modules with real signatures, data and rules that implementers build from — grilled with sketched options, posted as a comment on the spec, saved to .scratch/<slug>/design.md and mirrored into the repo's architecture docs.
disable-model-invocation: true
---

# To Design

Decide HOW a spec gets built before an implementer decides it for you. The result is a **design**: one comment on the spec, fully concrete, in the template at the end of this file, plus the repo docs moved to the intended state. The design opens with its **concept**, the half a person reads; the sections after it are what implementers build from. Downstream, `/to-tickets` sees the design because it reads the spec's comments, `/to-workflow` copies the last design into `workflow.json`, and `/run-workflow` pastes it into every implementer and reviewer prompt. Optional in the chain: grill → spec → tickets works without it; run it any time after `/to-spec`.

The issue tracker should have been provided (the `## Agent skills` section of CLAUDE.md) — run `/setup-matt-pocock-skills` if not. Invoke the Skill tool for `codebase-design` and for `domain-modeling` now: **module, interface, seam, adapter, depth, locality** and the CONTEXT.md terms are the only vocabulary the design is written in. Every drawing in this skill is a **sketch** in the sense of the Sketches section below.

## 1. Gather

- **The spec**: the argument is a `.scratch/<slug>/spec.md` path, an issue number or a URL; with no argument, the spec `/to-spec` produced in this session. Read its full body and every comment, the way `docs/agents/issue-tracker.md` says to fetch a ticket. The slug is the `.scratch/<slug>` directory name, or the spec issue's title slugified.
- **The docs**, each skipped silently when missing: `CONTEXT.md` (or the contexts `CONTEXT-MAP.md` points at), `docs/adr/`, `CODING_STANDARDS.md`, `ARCHITECTURE.md`.
- **Existing tickets** for this spec: `.scratch/<slug>/issues/`, or the issues that reference the spec.
- **The code**: the entry points and modules the spec's Implementation Decisions name, the tests its Testing Decisions cite as prior art, and everything the design will have to call or change.
- **Mode**: when the spec already carries a comment whose first bold word is **Design**, ask the user which mode they want and wait: **amend** — the last design is the draft and step 2 is skipped — or **fresh** — the full draft, because the code or the spec moved too far for an amendment. The choice is theirs every time.

**Done when:** spec, docs, tickets and touched code are read, and the mode is known.

## 2. Draft (fresh mode)

Design it twice, once, at feature level: the pattern in `codebase-design`'s `DESIGN-IT-TWICE.md`, applied to the whole feature's module set instead of one module. Each design a sub-agent returns is a **candidate**.

1. **Frame the problem space** for the user: the constraints any design must satisfy, the dependencies with their category from `DEEPENING.md`, and a sketch that makes the constraints concrete. Show it, then continue without waiting.
2. **Spawn three general-purpose sub-agents in parallel**, a fourth when the feature touches an external system. Same brief for all, one constraint each:
   - minimise the interface: one to three entry points per module, maximum leverage per entry point;
   - maximise flexibility: many use cases, room for extension;
   - optimise for the most common caller: the default case is trivial;
   - (external system only) ports and adapters at every cross-seam dependency.

   The brief carries the spec, the docs read in step 1, the design template and the Sketches section below, the `codebase-design` glossary, the paths of the code read in step 1 and its constraint. Each agent returns one complete candidate in the template as its final text and nothing else.
3. **Present and compare**: show each candidate's Concept section, one after the other, and nothing else of it; the full candidates stay in the conversation for step 3. Then compare them in prose by depth, locality and seam placement, and recommend one candidate or a hybrid. Be opinionated.

**Done when:** the user has seen every candidate's Concept and the recommendation.

## 3. Grill

Invoke the Skill tool for `grilling`. It owns the rounds, the frontier and the `❓`/`➡️` frame; this section supplies what goes inside them.

- **Agreed block first.** Before round one, list every point where all candidates made the same choice, one line each, under **Agreed by every candidate**. The user vetoes by naming a line; a vetoed line becomes a question in the next round. In amend mode the block is titled **Unchanged from v<n>** and lists the sections the requested change does not touch.
- **The frontier** is every point where the candidates diverge, then every section of the template still unsettled, then each Rule. In amend mode: the change the user asked for, plus whatever the spec or the touched code changed since the last design was posted.
- **Options.** A question's options are the distinct choices the candidates made at that point; a Rule's options are the rule and no rule. In amend mode, with no candidates, propose two or three options yourself. Every option is written out in full in the question template below, so the user can choose any of them, not only the recommended one.
- `/domain-modeling` stays active: a module named after a concept missing from `CONTEXT.md` gets the term added on the spot; a decision that is hard to reverse, surprising without context and a real trade-off gets an ADR offer.
- An answer that holds for every feature, not just this one, is a **standing rule**: offer to append it to `CODING_STANDARDS.md`, creating the file with that first rule when it is missing. Answers specific to this feature go into the design's Rules.
- On request, run design-it-twice again on one module the user names.

Question template — one letter, name, one-sentence description, `Costs:` line and sketch per option, then the recommendation with the reason it beats the others:

```
❓ **Q3** - **Where does retry live?**: Three candidates put HTTP retry in three
different places. Decides who owns backoff policy and who can test it.

**a** Inside the client — client module owns retry; callers never see it.
    Costs: policy is fixed per client, no per-call override.
    ┌────────┐   ┌──────────────┐
    │ caller │──▶│ client+retry │──▶ http
    └────────┘   └──────────────┘

**b** Separate retry module — wraps any call; client stays a thin adapter.
    Costs: one more seam, every caller wires it.
    ┌────────┐   ┌───────┐   ┌────────┐
    │ caller │──▶│ retry │──▶│ client │──▶ http
    └────────┘   └───────┘   └────────┘

**c** At the call site — each caller retries itself.
    Costs: N copies of backoff; no single test surface.
    ┌────────┐
    │ caller │──▶ http   (×N, each with its own loop)
    └────────┘

➡️ **a** — two of three candidates chose it; b's seam has one adapter, so it is
hypothetical (codebase-design: one adapter = hypothetical seam).
```

**Gate.** When the frontier is empty, assemble the Concept from the settled answers, show it once, and ask whether to publish.

**Done when:** every section of the template is settled and the user has confirmed the Concept.

## 4. Publish

1. **Write the file**: `mkdir -p .scratch/<slug>` and write the whole comment, in the template below, to `.scratch/<slug>/design.md`. The comment starts with the line `> *Posted by /to-design.*`, a blank line, then `**Design** v<n>` where n is one more than the highest version already on the spec. The file is overwritten on every version; the versions live on the spec.
2. **Post the design** from that file, so comment and file never differ: GitHub `gh issue comment <n> --body-file .scratch/<slug>/design.md`, otherwise the tracker's post recipe (local tracker: append the file's contents under `## Comments` in `spec.md`). Earlier design comments stay untouched; the last one wins.
3. **Update `ARCHITECTURE.md`** to the intended state: the modules the design adds, changes or removes, in the map format below. Create it when missing, holding only the modules this design touches.
4. **Apply the remaining doc edits**: any accepted standing rule, CONTEXT.md term or ADR not written during the grilling.
5. **Existing tickets**: name every ticket that no longer fits the design — a prefactoring the tickets lack, a slice that cuts across a module — with a one-line reason each. Rerunning `/to-tickets` is the user's call.
6. **Hand off** with every doc edit left uncommitted. The hand-off message is: the files to commit (they must be on the base ref before `/to-workflow` creates the baseline, and `/to-workflow` refuses to run while they are not); the path `.scratch/<slug>/design.md`, where the signatures are read; the misfit tickets from 5; the next command — `/to-tickets <spec>` when no tickets exist, otherwise `/to-workflow`. The Concept was confirmed at the gate and is not repeated here.

**Done when:** the file is written, the comment is posted, the docs are edited, the hand-off message is sent.

## Sketches

A sketch is a small structural drawing that stands in for code: at most 10 lines, never a signature or a statement. One sketch per option in a grill question; several make up a Concept. Pick the form by what is being decided:

| Deciding | Sketch |
|---|---|
| module boundary, seam placement | boxes and arrows; a seam is the line an arrow crosses |
| wiring, call order | numbered arrow list: `A ─1─▶ B ─2─▶ C` |
| file layout | directory tree |
| interface shape | one line per entry point, `name(in) → out`, no types beyond that |
| data shape | table: field, kind, owner |
| a rule | before / after, two lines |

## Design template

Fully concrete: real paths, real signatures and type shapes in the project's language, real names. The Concept is the half a person reads; the sections after it hold what an implementer needs to build it as designed and nothing else. The whole comment is pasted into every implementer prompt. A candidate from step 2 fills the same template.

```markdown
> *Posted by /to-design.*

**Design** v1

## Concept
<module map: boxes and arrows with the seams drawn; at most 12 modules per
 diagram, split by layer past that>
<wiring: numbered arrow list of who calls whom, in order; the existing entry
 points that change are marked; at most one line of prose>
<file layout: tree of new and changed files>

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
