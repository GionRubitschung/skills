#!/bin/sh
# Merge gate for /run-plan — installed at preflight, removed at teardown.
# Plain POSIX shell + git; nothing else is installed or required.
#
# Replicates MR semantics on every merge into the baseline branch:
#   1. chain any displaced pre-existing hook
#   2. no open/disputed review threads for the issue being merged
#   3. quality commands green (fail fast), then full verify green,
#      run on the ACTUAL merge candidate sitting in the work tree
# Any failure aborts the merge commit. Agents never use --no-verify.
#
# Placeholders filled by /run-plan at install time:
#   __BASELINE_BRANCH__   e.g. feat/auth
#   __SCRATCH_DIR__       absolute path to .scratch/<slug>
#   __GATE_COMMANDS__     one `run '<cmd>'` line per Quality cmd, then per Verify cmd

BASELINE="__BASELINE_BRANCH__"
SCRATCH="__SCRATCH_DIR__"
MEMO="$SCRATCH/.green-tree"

# Only gate merges into the baseline branch; everything else is untouched.
[ "$(git symbolic-ref --short HEAD 2>/dev/null)" = "$BASELINE" ] || exit 0

# Chain a hook this one displaced, if any.
LOCAL="$(dirname "$0")/pre-merge-commit.local"
if [ -x "$LOCAL" ]; then
  "$LOCAL" || exit 1
fi

red() {
  echo "merge gate: RED — $1" >&2
  echo "merge gate: merge aborted; run 'git merge --abort' to clean up." >&2
  exit 1
}

# ── Review threads (cheap, so first) ─────────────────────────────────
# Identify the issue branch being merged from MERGE_HEAD.
MERGE_HEAD_FILE="$(git rev-parse --git-path MERGE_HEAD)"
if [ -f "$MERGE_HEAD_FILE" ]; then
  BRANCH="$(git name-rev --name-only --refs='refs/heads/*' "$(cat "$MERGE_HEAD_FILE")" 2>/dev/null)"
  N="$(printf '%s' "$BRANCH" | sed -n 's/.*-issue-\([0-9][0-9]*\)$/\1/p')"
  if [ -n "$N" ]; then
    FINDINGS="$SCRATCH/findings-$N.md"
    [ -f "$FINDINGS" ] || red "no findings file for issue $N ($FINDINGS) — unreviewed code does not merge"
    if grep -Eq '^## F[0-9]+ \[(open|disputed)\]' "$FINDINGS"; then
      echo "merge gate: unresolved threads in $FINDINGS:" >&2
      grep -E '^## F[0-9]+ \[(open|disputed)\]' "$FINDINGS" >&2
      red "open/disputed review threads block the merge"
    fi
  fi
fi

# ── Pipeline (skip if this exact tree already passed the gate) ───────
TREE="$(git write-tree)" || red "could not snapshot the merge candidate"
if [ -f "$MEMO" ] && [ "$(cat "$MEMO")" = "$TREE" ]; then
  exit 0
fi

run() {
  echo "merge gate: $1"
  sh -c "$1" || red "command failed: $1"
}

__GATE_COMMANDS__

# Record the verified tree — written only by this hook, only after green.
mkdir -p "$SCRATCH" && printf '%s' "$TREE" > "$MEMO"
exit 0
