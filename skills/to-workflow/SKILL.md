---
name: to-workflow
description: Prepare a workflow.json that /run-workflow executes: the ticket DAG, repo state, verification commands and models for implementing a set of tickets with background agents.
disable-model-invocation: true
---

# To Workflow

Turn the tickets from `/to-tickets` into one `.scratch/<slug>/workflow.json` that `/run-workflow` executes and never modifies. This skill spawns no agents and writes nothing until the user approves the summary in step 3.

The issue tracker and triage label vocabulary should have been provided (the `## Agent skills` section of CLAUDE.md) — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Gather the tickets

Work from the conversation when `/to-tickets` ran in this session. Otherwise the argument names the source: a `.scratch/<slug>` directory, a parent issue number or URL, or a list of issue numbers. Read every ticket in full, the way `docs/agents/issue-tracker.md` says to fetch a ticket.

Record per ticket: `id` as a string exactly as other tickets reference it (`"01"` for a local file, `"123"` for an issue), `ref` (repo-relative file path, or the issue number), `title` without any `NN — ` prefix, `blockedBy` normalised to ids (a line starting with "None" is an empty list; otherwise every ticket number or issue reference on the line), `human` (status or label `ready-for-human`), `body` (the full ticket text). The slug is the `.scratch/<slug>` directory name, or the parent issue title slugified.

Record also the **design**: the last comment on the parent spec whose first bold word is **Design** (posted by `/to-design`), verbatim, or none. And the **docs**: the contents of `CODING_STANDARDS.md` and `ARCHITECTURE.md` at the repo root, or none each.

**Done when:** every ticket has all six fields, the `blockedBy` graph is acyclic, and design and docs are read or known to be absent. A cycle is shown to the user and stops the skill.

### 2. Read the repo state

- **Baseline**: feature branch `feat/<slug>` checked out in its own worktree at `.claude/worktrees/<slug>`. Reuse both when they exist. Otherwise the base is the current branch, or the `HEAD` commit when detached; the user may name another base in step 3. Every ticket branches off this baseline and merges back into it; `/run-workflow` works from this worktree.
- **Done** tickets: the issue is closed, a local file's `Status:` is `resolved`, `done` or `closed`, or — only when `feat/<slug>` exists — `git log feat/<slug> --grep '^<closes trailer with the id>$'` finds a commit. Drop them from the list and from every `blockedBy`. Everything else stays, human and blocked tickets included; `/run-workflow` derives the rest of the state itself.
- Verification commands: from CLAUDE.md, `package.json` scripts, Makefile and CI config, pick the project's test, lint, typecheck and build commands. Each runs non-interactively from the worktree root and exits non-zero on failure; run each once on the current tree to confirm it starts.
- Guards: `git worktree list` shows `feat/<slug>` checked out anywhere other than `.claude/worktrees/<slug>` → stop and ask, the baseline must be the only checkout of that branch. `.git/info/exclude` lacks the lines `.claude/worktrees/` or `.scratch/` → added in step 4. The docs the run relies on — `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/`, `CODING_STANDARDS.md`, `ARCHITECTURE.md` — show changes in `git status --porcelain -- <paths>`, or exist in the checkout but not on the base ref (`git cat-file -e <base>:<path>` fails) → stop and ask the user to commit them: every worktree of the run is cut from the base ref and would not see them.

**Done when:** every remaining ticket is classified, the verification commands are chosen (fewer than four only when the project lacks that step), all three guards checked.

### 3. Confirm once

Show the user, in one message:

- the DAG: id, title, blocked by, human or not; the human tickets and every ticket transitively blocked by one, marked as not running;
- the baseline: base ref, feature branch, worktree path, and whether each already exists or will be created;
- tracker kind and closes trailer, the parent that receives the final report;
- the design: `Design v<n>` from the parent, or `no design`; whether `CODING_STANDARDS.md` and `ARCHITECTURE.md` were found;
- the verification commands;
- the model table with the defaults: `implementer` is `sonnet`; `reviewer` (code-review, ponytail-review and security-review) is `fable`; `verifier`, `merger` and `guide` are `haiku`; `inherit` means the session model;
- `maxTurns`, default 5: implement or fix runs a ticket gets before it is handed to the user;
- the agent count: 6 per runnable agent ticket plus 2 per fix round, 1 per human ticket.

Apply every change the user asks for. Nothing is written before they approve.

**Done when:** the user has approved the summary.

### 4. Write the file

`mkdir -p .scratch/<slug>` and write `.scratch/<slug>/workflow.json` with exactly this shape:

```json
{
  "slug": "greeting-api",
  "repo": "/abs/path/to/checkout",
  "featureBranch": "feat/greeting-api",
  "base": "main",
  "baseline": ".claude/worktrees/greeting-api",
  "worktrees": ".claude/worktrees",
  "verify": ["npm test", "npm run lint", "npm run typecheck", "npm run build"],
  "tracker": "local",
  "closesTrailer": "Ticket: {id}",
  "parent": ".scratch/greeting-api/spec.md",
  "maxTurns": 5,
  "models": { "implementer": "sonnet", "reviewer": "fable", "verifier": "haiku", "merger": "haiku", "guide": "haiku" },
  "design": "…the full Design comment from the parent, or null…",
  "standards": "…contents of CODING_STANDARDS.md, or null…",
  "architecture": "…contents of ARCHITECTURE.md, or null…",
  "tickets": [
    { "id": "01", "ref": ".scratch/greeting-api/issues/01-http-server.md", "title": "Minimal HTTP server with /health", "blockedBy": [], "human": false, "body": "…full ticket text…" }
  ]
}
```

`baseline` is the worktree where `featureBranch` is checked out, repo-relative. `tracker` is `local`, `github` or `gitlab`. `closesTrailer` is `Ticket: {id}` for local files and `Closes #{id}` on GitHub and GitLab. `parent` is the issue number, or the repo-relative spec path for local files. `ref` is repo-relative. Models are `inherit` or an Agent-tool alias: `sonnet`, `opus`, `haiku`, `fable`. `design`, `standards` and `architecture` carry the full text, never a path, so no agent has to go and read a file; each is `null` when absent.

Then create the baseline when missing: `git worktree add <repo>/.claude/worktrees/<slug> -b feat/<slug> <base>`, or without `-b … <base>` when the branch already exists. Add the exclude lines that are missing. Tell the user the baseline path and branch, and to run `/run-workflow <slug>`.

**Done when:** the file parses (`python3 -m json.tool` or `jq .`) and the hand-off message is sent.

## Rerun

Running `/to-workflow` again regenerates the file from the current tickets: done tickets drop out, new tickets come in. `/run-workflow` picks up in-flight work from git and ticket comments, so regenerating never loses progress.
