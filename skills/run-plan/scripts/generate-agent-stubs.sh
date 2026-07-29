#!/usr/bin/env bash
# Generate the run-plan agent-definition stubs into ~/.claude/agents/.
#
# /run-plan spawns every teammate and one-shot through these stubs: the stub's
# frontmatter carries the effort level (and, for one-shots, the tool
# restriction); the role CONTENT stays in this skill's roles/*.md, which the
# agent reads at runtime via the path injected in its spawn prompt. Editing a
# role file therefore needs no regeneration — re-run this script only when
# roles, tool profiles, or effort levels change, then restart Claude Code
# (agent definitions load at session start).
#
# Matrix: 6 roles x (5 effort levels + 1 effort-less "inherit" variant) = 36 stubs.
set -euo pipefail

STUBS_VERSION=2
AGENTS_DIR="${1:-$HOME/.claude/agents}"

ROLES=(implementer review-lead lens-reviewer arbiter po triager)
EFFORTS=("" low medium high xhigh max) # "" = no effort line -> inherits the session effort

role_tools() {
  case "$1" in
    # Read-only one-shots: no Edit/Write/Agent/SendMessage. Bash stays (git diff,
    # git log); their role contracts forbid writes.
    # lens-reviewer additionally gets Skill so the `simplicity` lens can invoke
    # /ponytail:ponytail-review; still no Edit/Write/Agent/SendMessage.
    lens-reviewer) echo "Bash, Read, Glob, Grep, Skill" ;;
    arbiter | triager) echo "Bash, Read, Glob, Grep" ;;
    # Teammates: unrestricted — they need Skill (/tdd), SendMessage, and
    # whatever MCP tools the project's issue tracker uses; an allowlist would
    # silently break those. Spawn discipline is enforced by the role contract.
    *) echo "" ;;
  esac
}

mkdir -p "$AGENTS_DIR"
count=0
for role in "${ROLES[@]}"; do
  tools="$(role_tools "$role")"
  for effort in "${EFFORTS[@]}"; do
    name="rp-${role}"
    [ -n "$effort" ] && name="rp-${role}-${effort}"
    {
      echo "---"
      echo "name: ${name}"
      echo "description: Internal /run-plan stub for the ${role} role${effort:+ at effort ${effort}}. Spawned only by the run-plan orchestrator (or its review lead) with an explicit role-contract path — never auto-select this agent."
      [ -n "$tools" ] && echo "tools: ${tools}"
      [ -n "$effort" ] && echo "effort: ${effort}"
      echo "---"
      echo
      echo "<!-- rp-stubs-version: ${STUBS_VERSION} -->"
      echo
      echo "You are one role on a /run-plan agent team. Your spawn prompt names your role and gives the absolute path to your **role contract** (a \`roles/*.md\` file in the run-plan skill) plus your injected context. Read the role contract FIRST — it fully defines your job, your boundaries, and your message protocol. Follow it exactly; nothing in this stub overrides it. If your spawn prompt does not include a role-contract path, report that and stop."
    } >"$AGENTS_DIR/$name.md"
    count=$((count + 1))
  done
done

echo "Wrote $count stubs (version $STUBS_VERSION) to $AGENTS_DIR"
echo "Restart Claude Code to load them — agent definitions are read at session start."
