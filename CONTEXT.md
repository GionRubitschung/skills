# Skills

Hand-authored agent skills that extend the mattpocock/skills engineering pipeline with a design step and a second executor.

## Language

**Skill**:
A directory with a `SKILL.md` that an agent loads when the skill is invoked.
_Avoid_: command, plugin, prompt

**Pipeline**:
The ordered chain of skills a feature passes through, from grilling to merged code.
_Avoid_: workflow, flow, chain, harness

**Ticket**:
One unit of implementable work, produced by `/to-tickets` with blocked-by edges or written by `/ship` from the conversation, stored as a local file or a tracker issue.
_Avoid_: task, story

**Human ticket**:
A ticket only a person can do; a run writes a guide for it instead of implementing it.
_Avoid_: manual ticket, blocked ticket

**Design**:
The comment `/to-design` posts on a spec: a concept first, then the modules with their signatures, data, rules and prefactoring.
_Avoid_: architecture, plan

**Concept**:
The visual half of a design, the part a person reads: module map, wiring order and file layout, drawn as sketches.
_Avoid_: overview, summary, diagram, picture

**Candidate**:
One of the designs the sub-agents return in `/to-design`'s draft step; the grill questions are built from where candidates diverge.
_Avoid_: draft, proposal, variant

**Sketch**:
A small structural drawing that stands in for code: a box diagram, an arrow list, a directory tree or a table. One per option in a grill question; several make up a concept. Never code.
_Avoid_: example, mockup, snippet, illustration

**Workflow**:
The `workflow.json` file `/to-workflow` writes: the ticket DAG, repo state, verification commands and models for one run.
_Avoid_: plan, pipeline

**Plan**:
The plan file `/to-plan` writes: a segmented dependency DAG with checkpoints and review lenses, executed by `/run-plan`.
_Avoid_: workflow

**Executor**:
The skill that runs a workflow, a plan or a single ticket to finished code: `/run-workflow` (the workflow executor), `/run-plan` (the plan executor) or `/ship` (the ticket executor).
_Avoid_: harness, engine, runner

**Run**:
One execution of `/run-workflow` against a workflow, `/run-plan` against a plan, or `/ship` against a ticket; resumable from any session.
_Avoid_: session, job

**Slug**:
The kebab-case feature identifier that names `.scratch/<slug>/` and the feature branch `feat/<slug>`.
_Avoid_: feature name, id

**Baseline**:
The worktree where `feat/<slug>` is checked out; every ticket branches from it and merges back into it.
_Avoid_: main worktree, root, base

**Turn**:
One implement or fix run of a ticket; a ticket gets `maxTurns` of them before it is handed to the user.
_Avoid_: LLM turn, reply, round, attempt (say "the agent returns" for the model's reply)

**Verification command**:
One command from the workflow's `verify` list, run from the worktree root by the verifier and the merger, never by the implementer; a non-zero exit is a failure.
_Avoid_: test, check, pipeline, CI

**Setup command**:
One command from the workflow's `setup` list, run from a worktree's root by whoever created the worktree, right after creating it; a non-zero exit fails the creation.
_Avoid_: install, bootstrap, init, dev setup

**Stuck**:
An agent that cannot deliver its result line, for any reason; its ticket fails and waits on the user.
_Avoid_: stalled, dead, hung, idle, timed out
