#!/bin/bash
# Git Guard Hook — enforces /git skill activation for git write operations and gh commands.
#
# This is a PreToolUse hook that fires on Bash tool calls. It checks whether the
# command is a git write operation or gh command and emits a strong warning if the
# /git skill has not been invoked.
#
# Why warn instead of block?
# The /git skill itself runs git/gh commands via Bash. Blocking would create an
# infinite loop. Instead, we emit a directive that Claude can reason about:
# if the skill is already active, proceed; if not, invoke it first.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Exit early if no command or jq failed
[ -z "$COMMAND" ] && exit 0

# --- gh commands: ALWAYS require /git skill ---
if echo "$COMMAND" | grep -qE '(^|\s|&&|\||\;)gh\s'; then
  echo "⚠️  GIT GUARD: gh command detected."
  echo "RULE: All gh commands MUST go through the /git skill."
  echo "If /git skill is already active, proceed. Otherwise, invoke /git first."
  exit 0
fi

# --- git write commands: require /git skill ---
# Match: git commit, git push, git merge, git rebase, git reset, git stash,
#        git cherry-pick, git revert, git worktree add/remove, git tag
if echo "$COMMAND" | grep -qE '(^|\s|&&|\||\;)git\s+(commit|push|merge|rebase|reset|stash|cherry-pick|revert|tag)\b'; then
  echo "⚠️  GIT GUARD: git write operation detected ($(echo "$COMMAND" | grep -oE 'git\s+\w+' | head -1))."
  echo "RULE: Git write operations MUST go through the /git skill for conventional commit enforcement and branch protection."
  echo "If /git skill is already active, proceed. Otherwise, invoke /git first."
  exit 0
fi

# --- git worktree add/remove ---
if echo "$COMMAND" | grep -qE '(^|\s|&&|\||\;)git\s+worktree\s+(add|remove|prune)\b'; then
  echo "⚠️  GIT GUARD: git worktree modification detected."
  echo "RULE: Worktree operations MUST go through the /git skill."
  echo "If /git skill is already active, proceed. Otherwise, invoke /git first."
  exit 0
fi

# --- git checkout -b / git switch -c (branch creation) ---
if echo "$COMMAND" | grep -qE '(^|\s|&&|\||\;)git\s+(checkout\s+-b|switch\s+-c)\b'; then
  echo "⚠️  GIT GUARD: branch creation detected."
  echo "RULE: New branches MUST be created through the /git skill (as worktrees with proper naming)."
  echo "If /git skill is already active, proceed. Otherwise, invoke /git first."
  exit 0
fi

# All other commands pass silently
exit 0
