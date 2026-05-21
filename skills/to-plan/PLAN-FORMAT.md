# Plan File Format

`/to-plan` writes this file; `/run-plan` reads it and mutates the status tokens as it runs. It lives at `.scratch/<prd-slug>/plan.md` inside the baseline worktree and is **not committed**.

## Template

```
# Implementation Plan: <PRD title>

## Meta

- PRD: <issue reference or URL>
- Baseline branch: feat/<slug>
- Base ref: <branch or sha>
- Worktree root: .claude/worktrees/
- Parallelism cap: 3
- Review max rounds: 5
- Between-phase gating: pause          # pause | auto
- Verify: <command>                    # may list several, e.g. backend / frontend
- Copy into worktrees: .env            # gitignored paths agents need; "—" if none

## Issues

| #   | Title             | Blocked by | HITL mode | Notes        |
| --- | ----------------- | ---------- | --------- | ------------ |
| 12  | Create db models  | —          | —         |              |
| 13  | Auth backend      | 12         | —         |              |
| 14  | Frontend sign-in  | 12         | escalate  | writes to db |
| 15  | Wire auth calls   | 13, 14     | —         |              |

## Schedule

### Step 1 — Phase

- [ ] #12 Create db models — pending

### Step 2 — Checkpoint

Run the database migration manually, then continue:
<command or instructions>

### Step 3 — Phase

- [ ] #13 Auth backend — pending
- [ ] #14 Frontend sign-in — pending

### Step 4 — Phase

- [ ] #15 Wire auth calls — pending
```

## Field notes

- **HITL mode** is `—` for AFK issues, `manual` or `escalate` for HITL issues.
- **Notes** carries the per-issue context captured in the interview.
- **Verify** may hold more than one command (e.g. a monorepo's backend and frontend suites); agents run the one(s) relevant to the files they touched.

## Step types

- **Phase** — issues implemented in parallel, subject to the parallelism cap. A phase wider than the cap runs in serial sub-batches in listed order.
- **Checkpoint** — a manual-intervention pause. `/run-plan` prints the text and waits for the user.
- **HITL-manual issue** — a phase containing a single issue whose HITL mode is `manual`; `/run-plan` sets up the worktree but the user writes the code.

## Status values

`/run-plan` updates each issue's status token in place:

`pending` → `in-progress` → `in-review` → `po-review` → `merged`

`blocked` marks an issue waiting on a human escalation. Tick the checkbox when the issue reaches `merged`.
