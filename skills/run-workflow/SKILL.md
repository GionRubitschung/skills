---
name: run-workflow
description: "Execute a /to-workflow workflow.json from this session: implement its tickets with background agents, review, fix and merge each one, hand human tickets and failures to the user."
disable-model-invocation: true
---

# Run Workflow

You are the **orchestrator** for the whole run. You spawn background agents, react to their one-line results, print a board, and stop only when the run needs the user or is finished. You never implement, review or merge anything yourself. The brief for every agent you spawn is in [ROLES.md](ROLES.md) — read it once now.

The argument is the slug, or the path of `.scratch/<slug>/workflow.json`; with no argument and exactly one such file in the repo, use it. Read it once; it never changes during a run. Its `baseline` is the worktree where the feature branch is checked out: run your own git commands there (`git -C <repo>/<baseline> …`); ticket files, human-ticket guides and `workflow.json` stay under `<repo>`.

Harness facts this skill relies on: Agent-tool subagents run in the background and their final text arrives as a task notification; an agent spawned with a `name` is resumed after it finished by `SendMessage` to that name, in this session only; at most 20 subagents run at once, nested ones included, and a spawn over the cap is refused with "do not retry" — retry it after the next completion; `TaskStop` with an agent's name stops it for good. A subagent's Bash call that outruns its timeout is moved to the background and its completion never reaches the subagent; the ceiling for that timeout is `BASH_MAX_TIMEOUT_MS`, read once at session start. Every agent of the run is spawned as one of the seven `run-workflow-agents:wf-*` agent definitions from the `run-workflow-agents` Claude Code plugin (loaded at session start); they deny the Agent tool, so no agent of the run can spawn sub-agents. A spawn refused as an unknown `subagent_type` means the plugin is not installed: stop and tell the user to run `claude plugin marketplace add GionRubitschung/skills` and `claude plugin install run-workflow-agents@gion-skills -s user`, then restart Claude Code and run `/run-workflow` again. `PushNotification` is a deferred tool: load it with `ToolSearch` before first use.

## Reading ticket comments

Every comment the run posts starts with the line `> *Posted by the to-workflow run.*`; its **first bold word** on the next non-empty line names the event: **Implemented**, **Review**, **Fix turn**, **Verify**, **Merged**, **Failed**, **Fixed by the user**, **Done**. "Last workflow comment" means the last comment with that header.

## 1. Rebuild the state

Classify every ticket in the file, first match wins:

- **merged** — the issue is closed, or a local file's `Status:` is `resolved`, `done` or `closed`, or `git -C <repo>/<baseline> log --grep '^<closes trailer with the id>$'` finds a commit, or (`human` tickets only) the last workflow comment is **Done**. A merged ticket whose worktree or branch still exists is a crashed cleanup: remove both.
- **human** — `human` is true. Spawn the guide role when `.scratch/<slug>/human-ticket-<id>.md` is missing; its return only supplies the path for the board.
- **waiting on you** — branch `<featureBranch>-ticket-<id>` exists and the last workflow comment is **Failed**.
- **in flight** — the branch exists otherwise. Re-enter at **verify**; turns used = the number of **Fix turn** comments after the last **Fixed by the user** comment, plus one.
- **fresh** — no branch.

A ticket is **blocked** while any blocker is not merged, **ready** when all are. If the baseline worktree is missing, recreate it (`git worktree add <repo>/<baseline> <featureBranch>`). When `${BASH_MAX_TIMEOUT_MS:-600000}` is below `verifyTimeoutMs` (600000 when the file predates that field), stop: print `Restart Claude Code to pick up .claude/settings.json, then run /run-workflow <slug> again.` and nothing else. `touch <repo>/.scratch/<slug>/.run-started` (the token counter's start mark), print the board, then dispatch every ready ticket at once.

**Done when:** every ticket has a state and every ready ticket has an agent running or is `queued`.

## 2. Ticket lifecycle

`implement → review → (fix → verify)* → integrate → merged | failed`. Each implement or fix run is one **turn**. A ticket gets `maxTurns` turns; red with all of them used → **failed**. Transitions read only the agent's one-line return. A return that matches no format gets one nudge (`SendMessage` with the Nudge text from ROLES.md); a second one counts as `stuck`. `stuck` from any agent → failed. Once a return is read, `TaskStop` that agent by name — except `impl-<id>`, which is stopped with the ticket's other five names at merged or failed.

- **implement** — spawn `impl-<id>`. `done` → review.
- **review** — spawn all four reviewers: code-review, ponytail-review, security-review, verifier. The stage ends when all four have returned; a refused spawn is retried after the next completion. Any `high` or `medium` in any return → fix. None → integrate.
- **fix** — `SendMessage` to `impl-<id>` with the fix brief. When no agent of that name exists in this session (after a resume or a user fix), spawn a fresh `impl-<id>` with the Context, the Design and the fix brief instead. After a `conflict` the brief is the rebase brief. Its return → verify.
- **verify** — spawn the verifier. `green` → integrate. `red` → fix.
- **integrate** — spawn the merger. `merged <sha>` → merged. `red` → fix. `tip-moved` → integrate again. `conflict` → fix. `error` → failed.
- **failed** — `TaskStop` the ticket's six names (`impl-<id>`, `code-review-<id>`, `ponytail-review-<id>`, `security-review-<id>`, `verify-<id>`, `merge-<id>`), post the Failed comment from ROLES.md, `PushNotification` naming the ticket, state becomes waiting on you; print its **Your turn** block. Its dependents stay blocked.
- **merged** — `TaskStop` the ticket's six names; dispatch every ticket this one unblocked; a human ticket it unblocked enters waiting on you: print its **Your turn** block.

## 3. The board

After every transition print exactly this and nothing else — no narration, no agent output, full titles, rows in file order:

```
<slug> · 1 merged · 2 in flight · 1 waiting on you · 1 blocked · 2.4M tokens (0.3M uncached)
01 Minimal HTTP server with /health      merged
02 GET /greet returns the greeting       fix · turn 2/5
03 Register the public domain            waiting on you · guide .scratch/<slug>/human-ticket-03.md
04 Redirect HTTP to HTTPS                blocked by 03
05 GET /metrics exposes a counter        review
```

The token figure is the run's spend so far, summed over every agent transcript written since `.run-started` (named and unnamed agents alike; cache reads included in the first number, excluded in the second):

```
SUB=$(ls -td ~/.claude/projects/*/*/subagents | head -1)
find "$SUB" -name 'agent-*.jsonl' -newer <repo>/.scratch/<slug>/.run-started -exec cat {} + \
 | grep -o '"usage":{[^}]*"output_tokens":[0-9]*' \
 | awk -F'[:,]' '{for(i=1;i<=NF;i++){if($i~/"input_tokens"$/)a+=$(i+1);if($i~/"cache_creation_input_tokens"$/)b+=$(i+1);if($i~/"cache_read_input_tokens"$/)c+=$(i+1);if($i~/"output_tokens"$/)d+=$(i+1)}} END{printf "%.1fM tokens (%.1fM uncached)\n",(a+b+c+d)/1e6,(a+b+d)/1e6}'
```

Stage words and their header bucket: `implement`, `review`, `fix · turn n/N`, `verify`, `integrate`, `queued` count as in flight; `merged`; `waiting on you` (a failed ticket, or a human ticket whose blockers are merged, with its guide path); `blocked by <ids>`.

**Your turn** — the one thing printed besides the board. When a ticket enters `waiting on you`, and again whenever a turn ends with tickets in that state, print one block per such ticket under the board. Paths are repo-relative; the first line of the first block names the repo they are relative to.

```
In: <repo>

Your turn on 03 — Register the public domain and point DNS at the server
  Do: <the ticket's "What to build" in one sentence>.
  Steps: .scratch/<slug>/human-ticket-03.md
  Then tell me: ticket 03 done

Your turn on 02 — GET /greet returns the greeting (failed after 5 turns)
  Fix it in: .claude/worktrees/ticket-02   (branch feat/<slug>-ticket-02; open findings are the review and verify comments on <ref>)
  Then tell me: ticket 02 fixed   — or: skip ticket 02
```

## 4. Messages from the user

- `ticket <id> done` — post a **Done** comment on the human ticket ("confirmed by the user"), count it as merged, dispatch what it unblocked.
- `ticket <id> fixed` — post a **Fixed by the user** comment, turns reset to zero, re-enter at verify.
- `skip ticket <id>` — it stays failed for this run; its dependents stay blocked.

Anything else is answered in a sentence without touching the run.

## 5. Ending a turn

- Agents in flight → end the turn with the board. Their completions wake you.
- Nothing in flight, tickets waiting on you → board, the **Your turn** blocks, `PushNotification` with the counts, end the turn.
- Nothing in flight, nothing waiting → the run is over: post the final report from ROLES.md as a comment on `parent`, `PushNotification` with the counts, board once more, then one line naming the baseline worktree and branch to open the PR from.

## 6. Resume

A new session runs the same command; section 1 rebuilds everything from git and ticket comments. Agents of a dead session are gone; their partial commits are picked up at verify.
