# Roles

Briefs for the agents `/run-workflow` spawns. Every spawn is `Agent` with `subagent_type` set to the role's agent definition — `run-workflow-agents:wf-implementer`, `run-workflow-agents:wf-code-reviewer`, `run-workflow-agents:wf-ponytail-reviewer`, `run-workflow-agents:wf-security-reviewer`, `run-workflow-agents:wf-verifier`, `run-workflow-agents:wf-merger`, `run-workflow-agents:wf-guide` (the `run-workflow-agents` Claude Code plugin; each denies the Agent tool, and all but the implementer and the guide deny every file-editing tool) — `description: "<role> for ticket <id>"`, `name`: `impl-<id>` for the implementer, otherwise `code-review-<id>`, `ponytail-review-<id>`, `security-review-<id>`, `verify-<id>`, `merge-<id>`, `guide-<id>` (the harness suffixes a repeated name), and `model` from `models` unless `inherit` (`models.reviewer` covers code-review, ponytail-review and security-review). Every prompt = **Context** + the role brief; the implementer, the fix, code-review and ponytail-review get **Design** between the two when `design` is not null; the guide gets only the first Context line. Values in `<…>` come from `workflow.json` and the ticket.

## Context (every prompt)

```
Feature "<slug>". Ticket <id> "<title>" (<ref>).
Repo: <repo>. Feature branch: <featureBranch>, checked out in the baseline worktree <repo>/<baseline>. Ticket worktree: <repo>/<worktrees>/ticket-<id> on branch <featureBranch>-ticket-<id>.
Run every command inside the ticket worktree (cd <worktree> && …) unless a step says otherwise. In the main checkout you only append to ticket files and write human-ticket guides under .scratch; never change its code or its branch. Never edit files in the baseline worktree.
Verification commands, run from the worktree root: <verify, one per line>
Run every verification command in the foreground with the Bash `timeout` parameter set to <verifyTimeoutMs>: a Bash call that outruns its timeout is moved to the background and its completion never reaches you, and `sleep` is blocked. A command that outruns <verifyTimeoutMs> makes your final line `<role> <id>: stuck — <command> exceeded <verifyTimeoutMs/1000>s`, with the `<role>` word your brief's final line starts with; the same `<role> <id>: stuck — <one reason>` is your final line whenever you cannot finish the brief.
Ticket comments: <read recipe>. Post a comment: <post recipe>. Every comment you post starts with the line "> *Posted by the to-workflow run.*", then a blank line, then the bold event word given in your brief; the rest is plain prose for a human, no JSON.
Your final text is exactly one line in the format given below and nothing else, no summary before it; everything else goes into a ticket comment.
```

Tracker recipes:

| tracker | read comments | post a comment |
|---|---|---|
| `local` | read `<repo>/<ref>`; comments are under its `## Comments` heading | append to `<repo>/<ref>` under `## Comments` (add the heading at the end if missing) |
| `github` | `gh issue view <id> --comments` | `gh issue comment <id> --body-file <tmp file>` |
| `gitlab` | `glab issue view <id> --comments` | `glab issue note <id> --message "<text>"` |

## Design (implementer, fix, code-review, ponytail-review; only when `design` is not null)

```
Design for the feature, posted on <parent> by /to-design — the agreed HOW for every ticket of this run:
<design>
```

## implementer (spawn, name `impl-<id>`)

```
Worktree: if <worktree> exists, use it; else if branch <featureBranch>-ticket-<id> exists: cd <repo> && git worktree add <worktree> <featureBranch>-ticket-<id>; else: cd <repo> && git worktree add <worktree> -b <featureBranch>-ticket-<id> <featureBranch>
Invoke the Skill tool for "ponytail:ponytail", then for "tdd", and follow both.
Build the ticket as the Design says: the ticket decides what, the Design decides how, the repo standards fill what the Design leaves open, ponytail governs the rest. Deviate from the Design only where following it would break an acceptance criterion or the code makes it impossible, and declare each deviation in the Implemented comment.
Implement the ticket below in full; its acceptance criteria are the checklist. Commit as you go; the last line of every commit message body is exactly: <closesTrailer with the id>
Run the verification commands before finishing and fix what fails.
Then post a comment: "**Implemented** on branch <featureBranch>-ticket-<id> (<n> commits)." followed by the criteria only a human can check (visual, device, external service), if any, as "Could not verify by running: …", and one line per deviation as "Deviation: <what> — <reason>".
Final line: `impl <id>: done, <n> commits, <k> unverified`

Repo standards (CODING_STANDARDS.md):
<standards>

Architecture map (ARCHITECTURE.md):
<architecture>

Ticket:
<body>
```

The two doc sections are omitted when their value is null.

### fix (SendMessage to `impl-<id>`, or Context + Design + this for a fresh spawn)

```
Fix turn <n> of <maxTurns> for ticket <id>. Read the ticket comments (<read recipe>); address every finding marked [high] or [medium] in the review and verify comments posted after the last "Fix turn" comment, in the worktree, using /ponytail:ponytail, /tdd and the Design as before. Commit with the same trailer. Decline a finding only when acting on it would break an acceptance criterion.
Then post a comment: "**Fix turn <n>** — addressed <a>, declined <d>." with one line per declined finding and its reason.
Final line: `fix <id>: done, <a> addressed, <d> declined`
```

### rebase (the fix brief after a `conflict`, delivered the same way)

```
Fix turn <n> of <maxTurns> for ticket <id>: the merger could not rebase your branch. In the worktree: git rebase <featureBranch>; on a conflict invoke the Skill tool for "resolving-merge-conflicts" and finish the rebase. Run the verification commands and fix what fails, using /ponytail:ponytail, /tdd and the Design as before; commit with the same trailer.
Then post a comment: "**Fix turn <n>** — rebased onto <featureBranch>, resolved <files>."
Final line: `fix <id>: done, rebased`
```

## code-review

```
Invoke the Skill tool for "code-review". Fixed point: <featureBranch>. Spec: the ticket text below together with the Design, the agreed HOW; the Implemented comment on the ticket may declare deviations from it with reasons. Run the Standards axis and then the Spec axis yourself, one after the other, each following the skill's brief. Never end your turn before the final line.
Post its report as a comment headed "**Review: code-review** — <h> high, <m> medium, <l> low", one line per finding: "- [high|medium|low] <file>:<line> — <what>". severity: high = behaviour missing or wrong against the ticket, a deviation from the Design that no declared reason justifies, or a breach of a documented repo standard; medium = a baseline smell or scope creep worth fixing before merge; low = a nit.
Final line: `code-review <id>: <h> high, <m> medium, <l> low`

Ticket:
<body>
```

## ponytail-review

```
Invoke the Skill tool for "ponytail:ponytail-review" on: git diff <featureBranch>...HEAD
The Design is the agreed structure: a module, seam, interface or file the Design mandates is not a finding; review what the diff adds beyond it.
Post a comment headed "**Review: ponytail-review** — <h> high, <m> medium, <l> low", one line per finding: "- [high|medium|low] " followed by the skill's own line. severity: medium by default; high when it names a new dependency or a whole module to delete; low for a "shrink" under five lines. "Lean already" = no findings.
Final line: `ponytail-review <id>: <h> high, <m> medium, <l> low`
```

## security-review

```
Invoke the Skill tool for "security-review" on: git diff <featureBranch>...HEAD. Do the review yourself. Never end your turn before the final line.
Post a comment headed "**Review: security-review** — <h> high, <m> medium, 0 low", one line per vulnerability: "- [high|medium] <file>:<line> — <what>". severity: high for High confidence, medium for Mixed.
Final line: `security-review <id>: <h> high, <m> medium, 0 low`
```

## verifier

```
Run every verification command, in order, all of them even when one fails.
When any fails, post a comment headed "**Verify** — red", one line per failing command: "- [high] <command> — " followed by the last 15 lines of its output; final line: `verify <id>: red, <n> high`.
When all pass, post nothing; final line: `verify <id>: green`
```

## merger

```
1. Inside the worktree: git rebase <featureBranch>. On a conflict: git rebase --abort, final line `merge <id>: conflict — <files>`.
2. Run every verification command. Any failure: post a comment headed "**Verify** — red after rebase" in the verifier's format, final line `merge <id>: red, <n> high`, and leave the worktree as it is.
3. Fast-forward the feature branch in the baseline worktree: cd <repo>/<baseline> && git merge --ff-only <featureBranch>-ticket-<id>. "Not possible to fast-forward" or an index.lock in use: final line `merge <id>: tip-moved`. Any other refusal: `merge <id>: error — <message>`.
4. cd <repo> && git worktree remove --force <worktree> && git branch -D <featureBranch>-ticket-<id>
5. Post a comment: "**Merged** into <featureBranch> at <new tip sha>."
Final line: `merge <id>: merged <sha>`
```

## guide (human ticket)

```
Ticket <id> is marked ready-for-human: a person does this work. Write <repo>/.scratch/<slug>/human-ticket-<id>.md (mkdir -p the directory), a Markdown page for that person:
- title line: "# Ticket <id> — <title>" and the reference <ref>;
- "## What to do": numbered steps a stranger could follow, one action each, with the URL, console or command where known; where the exact UI is unknown, say what to achieve, not invented clicks;
- "## Values to record": each value the steps produce and where it belongs (.env key, secret name, password manager), or "none";
- "## Done when": the ticket's acceptance criteria as an unchecked checklist (`- [ ]`), for the person to tick;
- "## Then": the line `Tell the orchestrating session: ticket <id> done`;
- "## Ticket": the full ticket text, verbatim.
Final line: `guide <id>: <path>`

Ticket:
<body>
```

## Nudge (`SendMessage`, once, to an agent whose return matched no format)

```
Your last reply was not your final line. A Bash call that outran its timeout was moved to the background and its completion never reaches you. Run it again in the foreground with the Bash timeout parameter set to <verifyTimeoutMs>, finish your brief, and reply with the final line only.
```

## Comments the orchestrator posts itself

Failed:

```
> *Posted by the to-workflow run.*

**Failed** after <turns> turns. Worktree <worktree>, branch <featureBranch>-ticket-<id>, left as is. Open findings are in the review and verify comments above.
Fix it there, then tell the orchestrating session "ticket <id> fixed"; or "skip ticket <id>" to leave it.
```

Done (human ticket): `**Done** — confirmed by the user in the orchestrating session.`

Fixed by the user: `**Fixed by the user** — re-entering at verification with a fresh turn budget.`

Final report, on `parent`:

```
> *Posted by the to-workflow run.*

**Workflow <slug>** — <N> merged, <N> failed, <N> waiting on you, <N> blocked

Merged into <featureBranch>: one line per ticket "<id> <title> (<sha>)", plus "verify by hand: …" where the implementer listed unverified criteria.
Failed: one line per ticket "<id> <title> — <worktree>".
Waiting on you: one line per ticket "<id> <title> — <guide path>".
Blocked: one line per ticket "<id> <title> — by <ids>".
Baseline: <repo>/<baseline> on <featureBranch>.
Next: close the human tickets and rerun /run-workflow <slug>; open the PR from the baseline when done.
```
