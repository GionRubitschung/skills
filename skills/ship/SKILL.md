---
name: ship
description: "Implement one piece of work with background agents: a single ticket, or the shared understanding from this session. Implement, review, fix and verify it the way /run-workflow does one ticket, in the current directory or a worktree."
disable-model-invocation: true
---

# Ship

You are the **orchestrator** for one ticket. You spawn background agents, react to their one-line results, print one status line per transition, and stop only when the run needs the user or is finished. You never implement, review or fix anything yourself. The briefs for every agent you spawn are in [ROLES.md](ROLES.md) — read it once now.

Harness facts this skill relies on: Agent-tool subagents run in the background and their final text arrives as a task notification; an agent spawned with a `name` is resumed after it finished by `SendMessage` to that name, in this session only; `TaskStop` with an agent's name stops it for good. A subagent's Bash call that outruns its timeout is moved to the background and its completion never reaches the subagent; the ceiling for that timeout is `BASH_MAX_TIMEOUT_MS`, read once at session start. Every agent is spawned as one of the `run-workflow-agents:wf-*` agent definitions from the `run-workflow-agents` Claude Code plugin; a spawn refused as an unknown `subagent_type` means the plugin is not installed: stop and tell the user to run `claude plugin marketplace add GionRubitschung/skills` and `claude plugin install run-workflow-agents@gion-skills -s user`, then restart Claude Code and run `/ship` again. `PushNotification` is a deferred tool: load it with `ToolSearch` before first use.

## 1. The ticket

The argument names the ticket: an issue number or URL, or a local ticket file path. Read it in full, the way `docs/agents/issue-tracker.md` says to fetch a ticket (tracker `github` or `gitlab`, else `local`). A ticket with status or label `ready-for-human` stops the skill: there is nothing for an agent to do.

With no argument, write the ticket from the shared understanding in this session to `.scratch/<slug>/ticket.md`:

```
# <title>

## What to build
<the agreed behaviour, in prose>

## Acceptance criteria
- [ ] <one observable criterion per line>

## Comments
```

Record: `slug` (the kebab-case title), `ref` (the issue number, or the repo-relative file path), `trailer` (`Closes #<n>` for an issue, `Ticket: <slug>` for a local file), `body` (the full ticket text).

If the ticket already has comments whose first line is `> *Posted by /ship.*`, this is a resume: go to section 5.

## 2. Setup

- **Where**: ask the user: the current directory on the current branch as it is, uncommitted changes included, or a worktree `.claude/worktrees/<slug>` on branch `feat/<slug>` cut from `HEAD` (reused when it exists). Record `dir` and `branch`.
- **Verification commands**: from CLAUDE.md, `package.json` scripts, Makefile and CI config, pick the project's test, lint, typecheck and build commands, each non-interactive, run from `dir`, non-zero on failure. Run them all at once as background Bash calls and wait for every completion; `verifyTimeoutMs` is five times the longest wall clock, at least 600000. Note which are red now.
- **Docs**: the contents of `CODING_STANDARDS.md` and `ARCHITECTURE.md` at the repo root, or none each.
- **Defaults**: models `implementer` `sonnet`, `reviewer` (code-review, ponytail-review, security-review) `fable`, `verifier` `haiku`; `inherit` means the session model. `maxTurns` 5.

Show the user, in one message: the ticket text, `dir` and `branch`, the verification commands (with the ones already red) and `verifyTimeoutMs`, the models, `maxTurns`. Apply every change they ask for; nothing is created before they approve.

Then: create the worktree when chosen (`git worktree add .claude/worktrees/<slug> -b feat/<slug>`, without `-b` when the branch exists); add the lines `.claude/worktrees/` and `.scratch/` to `.git/info/exclude` when missing. When `${BASH_MAX_TIMEOUT_MS:-600000}` is below `verifyTimeoutMs`: set `env.BASH_MAX_TIMEOUT_MS` to `verifyTimeoutMs` in `.claude/settings.json` (create it, or merge keeping every other key), and stop with `Restart Claude Code to pick up .claude/settings.json, then run /ship <ref> again.` A ticket written from the conversation is already on disk, so `<ref>` is its path.

`touch .scratch/<slug>/.ship-started` (`mkdir -p` first), spawn the implementer.

## 3. Lifecycle

`implement → review → (fix → verify)* → done | failed`. Each implement or fix run is one **turn**; red with `maxTurns` turns used → failed. Transitions read only the agent's one-line return. A return that matches no format gets one nudge (`SendMessage` with the Nudge text from ROLES.md); a second one counts as `stuck`. `stuck` from any agent → failed. Once a return is read, `TaskStop` that agent by name — except `impl-<slug>`, which lives until done or failed.

- **implement** — spawn `impl-<slug>`. `done` → review.
- **review** — spawn all four reviewers: code-review, ponytail-review, security-review, verifier. The stage ends when all four have returned. Any `high` or `medium` → fix. None → done.
- **fix** — `SendMessage` to `impl-<slug>` with the fix brief. When no agent of that name exists in this session (after a resume or a user fix), spawn a fresh `impl-<slug>` with the Context and the fix brief. Its return → verify.
- **verify** — spawn the verifier. `green` → done. `red` → fix.
- **failed** — `TaskStop` every agent of the run, post the Failed comment from ROLES.md, `PushNotification`, print the **Your turn** block, end the turn.
- **done** — `TaskStop` every agent of the run, post the Done comment, `PushNotification`, print the status line and `Shipped on <branch> in <dir>; open the PR from there.`

The review diff is `<base>...HEAD`, where `<base>` is the parent of the oldest commit carrying the trailer: `git -C <dir> log --reverse --format=%H --grep '^<trailer>$' | head -1`, then `^`. Compute it after implement returns and after every resume.

## 4. Output

After every transition print exactly one line and nothing else:

```
ship <slug> · fix · turn 2/5 · 1.2M tokens (0.3M uncached)
```

Stages: `implement`, `review`, `fix · turn n/N`, `verify`, `done`, `failed`. The token figure is summed over every agent transcript written since `.ship-started` (cache reads included in the first number, excluded in the second):

```
SUB=$(ls -td ~/.claude/projects/*/*/subagents | head -1)
find "$SUB" -name 'agent-*.jsonl' -newer <repo>/.scratch/<slug>/.ship-started -exec cat {} + \
 | grep -o '"usage":{[^}]*"output_tokens":[0-9]*' \
 | awk -F'[:,]' '{for(i=1;i<=NF;i++){if($i~/"input_tokens"$/)a+=$(i+1);if($i~/"cache_creation_input_tokens"$/)b+=$(i+1);if($i~/"cache_read_input_tokens"$/)c+=$(i+1);if($i~/"output_tokens"$/)d+=$(i+1)}} END{printf "%.1fM tokens (%.1fM uncached)\n",(a+b+c+d)/1e6,(a+b+d)/1e6}'
```

**Your turn**, printed under the line when the ticket fails:

```
Your turn on <title> (failed after <turns> turns)
  Fix it in: <dir>   (branch <branch>; open findings are the review and verify comments on <ref>)
  Then tell me: fixed   — or: skip
```

User messages: `fixed` → post the Fixed by the user comment, turns reset to zero, re-enter at verify. `skip` → the run ends as it is. Anything else is answered in a sentence without touching the run.

## 5. Resume

Run on a ticket with `/ship` comments, in a new session. `dir` is `.claude/worktrees/<slug>` when it exists, else the current directory; `branch` is what `dir` has checked out. Choose the verification commands and `verifyTimeoutMs` as in setup, without asking. The last `/ship` comment decides: **Done** → print the done line and stop. **Failed** → print the **Your turn** block and wait. Anything else → re-enter at verify; turns used = the number of **Fix turn** comments after the last **Fixed by the user** comment, plus one.
