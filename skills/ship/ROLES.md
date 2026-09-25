# Roles

Briefs for the agents `/ship` spawns. Every spawn is `Agent` with `subagent_type` set to the role's agent definition — `run-workflow-agents:wf-implementer`, `run-workflow-agents:wf-code-reviewer`, `run-workflow-agents:wf-ponytail-reviewer`, `run-workflow-agents:wf-security-reviewer`, `run-workflow-agents:wf-verifier` (the `run-workflow-agents` Claude Code plugin; each denies the Agent tool, and all but the implementer deny every file-editing tool) — `description: "<role> for <slug>"`, `name`: `impl-<slug>`, `code-review-<slug>`, `ponytail-review-<slug>`, `security-review-<slug>`, `verify-<slug>` (the harness suffixes a repeated name), and `model` from the approved models unless `inherit`. Every prompt = **Context** + the role brief. Values in `<…>` come from the ticket and setup.

## Context (every prompt)

```
Ticket "<title>" (<ref>). Repo: <repo>. Work in <dir> on branch <branch>; run every command there (cd <dir> && …).
The directory may hold uncommitted changes that are not yours: never stage, commit, revert or stash them.
Run every command in the foreground with the Bash `timeout` parameter set to <verifyTimeoutMs>: a Bash call that outruns its timeout is moved to the background and its completion never reaches you, and `sleep` is blocked. A command that outruns <verifyTimeoutMs> makes your final line `<role> <slug>: stuck — <command> exceeded <verifyTimeoutMs/1000>s`, with the `<role>` word your brief's final line starts with; the same `<role> <slug>: stuck — <one reason>` is your final line whenever you cannot finish the brief.
Ticket comments: <read recipe>. Post a comment: <post recipe>. Every comment you post starts with the line "> *Posted by /ship.*", then a blank line, then the bold event word given in your brief; the rest is plain prose for a human, no JSON.
Your final text is exactly one line in the format given below and nothing else, no summary before it; everything else goes into a ticket comment.
```

Tracker recipes:

| tracker | read comments | post a comment |
|---|---|---|
| `local` | read `<repo>/<ref>`; comments are under its `## Comments` heading | append to `<repo>/<ref>` under `## Comments` (add the heading at the end if missing) |
| `github` | `gh issue view <id> --comments` | `gh issue comment <id> --body-file <tmp file>` |
| `gitlab` | `glab issue view <id> --comments` | `glab issue note <id> --message "<text>"` |

## implementer (spawn, name `impl-<slug>`)

```
Invoke the Skill tool for "ponytail:ponytail", then for "tdd", and follow both.
Implement the ticket below in full; its acceptance criteria are the checklist. The repo standards fill what the ticket leaves open, ponytail governs the rest.
Commit as you go, staging only the files you changed (never `git add -A` or `git commit -a`); the last line of every commit message body is exactly: <trailer>
Run only the test you are writing, in the narrowest invocation the runner has (one file, one name); the verifier runs the project's lint, typecheck, build and full suite after you.
Then post a comment: "**Implemented** on branch <branch> (<n> commits)." followed by the criteria only a human can check (visual, device, external service), if any, as "Could not verify by running: …".
Final line: `impl <slug>: done, <n> commits, <k> unverified`

Repo standards (CODING_STANDARDS.md):
<standards>

Architecture map (ARCHITECTURE.md):
<architecture>

Ticket:
<body>
```

The two doc sections are omitted when their value is none.

### fix (SendMessage to `impl-<slug>`, or Context + this for a fresh spawn)

```
Fix turn <n> of <maxTurns>. Read the ticket comments (<read recipe>); address every finding marked [high] or [medium] in the review and verify comments posted after the last "Fix turn" comment, using /ponytail:ponytail and /tdd as before, running only the tests you touch; the verifier re-runs the verification commands after you. Commit the same way, with the same trailer. Decline a finding only when acting on it would break an acceptance criterion.
Then post a comment: "**Fix turn <n>** — addressed <a>, declined <d>." with one line per declined finding and its reason.
Final line: `fix <slug>: done, <a> addressed, <d> declined`
```

## code-review

```
Invoke the Skill tool for "code-review". Fixed point: <base>. Spec: the ticket text below. Run the Standards axis and then the Spec axis yourself, one after the other, each following the skill's brief. Never end your turn before the final line.
Post its report as a comment headed "**Review: code-review** — <h> high, <m> medium, <l> low", one line per finding: "- [high|medium|low] <file>:<line> — <what>". severity: high = behaviour missing or wrong against the ticket, or a breach of a documented repo standard; medium = a baseline smell or scope creep worth fixing; low = a nit.
Final line: `code-review <slug>: <h> high, <m> medium, <l> low`

Ticket:
<body>
```

## ponytail-review

```
Invoke the Skill tool for "ponytail:ponytail-review" on: git diff <base>...HEAD
Post a comment headed "**Review: ponytail-review** — <h> high, <m> medium, <l> low", one line per finding: "- [high|medium|low] " followed by the skill's own line. severity: medium by default; high when it names a new dependency or a whole module to delete; low for a "shrink" under five lines. "Lean already" = no findings.
Final line: `ponytail-review <slug>: <h> high, <m> medium, <l> low`
```

## security-review

```
Invoke the Skill tool for "security-review" on: git diff <base>...HEAD. Do the review yourself. Never end your turn before the final line.
Post a comment headed "**Review: security-review** — <h> high, <m> medium, 0 low", one line per vulnerability: "- [high|medium] <file>:<line> — <what>". severity: high for High confidence, medium for Mixed.
Final line: `security-review <slug>: <h> high, <m> medium, 0 low`
```

## verifier

```
Verification commands, run from <dir>: <verify, one per line>
Run them all at once in one foreground Bash call, logs in a `mktemp -d` directory: each command as `( <command> > <logs>/<i>.log 2>&1; echo $? > <logs>/<i>.rc ) &`, then `wait`, then read every `.rc` — all of them even when one fails.
When any fails, post a comment headed "**Verify** — red", one line per failing command in list order: "- [high] <command> — " followed by the last 15 lines of its log; final line: `verify <slug>: red, <n> high`.
When all pass, post nothing; final line: `verify <slug>: green`
```

## Nudge (`SendMessage`, once, to an agent whose return matched no format)

```
Your last reply was not your final line. A Bash call that outran its timeout was moved to the background and its completion never reaches you. Run it again in the foreground with the Bash timeout parameter set to <verifyTimeoutMs>, finish your brief, and reply with the final line only.
```

## Comments the orchestrator posts itself

Each starts with `> *Posted by /ship.*` and a blank line.

Failed: `**Failed** after <turns> turns. Left as is in <dir> on <branch>. Open findings are in the review and verify comments above. Fix it there, then tell the orchestrating session "fixed"; or "skip" to leave it.`

Fixed by the user: `**Fixed by the user** — re-entering at verification with a fresh turn budget.`

Done: `**Done** on <branch>.` plus "Verify by hand: …" when the implementer listed unverified criteria.
