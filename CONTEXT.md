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
One unit of implementable work produced by `/to-tickets`, with blocked-by edges, stored as a local file or a tracker issue.
_Avoid_: task, story

**Human ticket**:
A ticket only a person can do; a run writes a guide for it instead of implementing it.
_Avoid_: manual ticket, blocked ticket

**Design**:
The comment `/to-design` posts on a spec: modules, signatures, file layout, wiring and rules.
_Avoid_: architecture, plan

**Workflow**:
The `workflow.json` file `/to-workflow` writes: the ticket DAG, repo state, verification commands and models for one run.
_Avoid_: plan, pipeline

**Plan**:
The plan file `/to-plan` writes: a segmented dependency DAG with checkpoints and review lenses, executed by `/run-plan`.
_Avoid_: workflow

**Executor**:
The skill that runs a workflow or a plan to merged code: `/run-workflow` (the workflow executor) or `/run-plan` (the plan executor).
_Avoid_: harness, engine, runner

**Run**:
One execution of `/run-workflow` against a workflow, or `/run-plan` against a plan; resumable from any session.
_Avoid_: session, job

**Slug**:
The kebab-case feature identifier that names `.scratch/<slug>/` and the feature branch `feat/<slug>`.
_Avoid_: feature name, id

**Baseline**:
The worktree where `feat/<slug>` is checked out; every ticket branches from it and merges back into it.
_Avoid_: main worktree, root, base
