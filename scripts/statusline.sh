#!/bin/bash
# Claude Code statusline — model | branch | cwd | session id
input=$(cat)

DIM='\033[90m'
RESET='\033[0m'
SEP="${DIM} | ${RESET}"

MODEL=$(echo "$input" | jq -r '.model.display_name')
SESSION=$(echo "$input" | jq -r '.session_id // empty')
CWD=$(echo "$input" | jq -r '.cwd // empty')

# Shorten home prefix to ~
CWD="${CWD/#$HOME/~}"

# Git branch
BRANCH=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
fi

# Build: model | branch | cwd | session id
OUT="${DIM}${MODEL}${RESET}"
[ -n "$BRANCH" ] && OUT="${OUT}${SEP}${DIM}${BRANCH}${RESET}"
[ -n "$CWD" ] && OUT="${OUT}${SEP}${DIM}${CWD}${RESET}"
[ -n "$SESSION" ] && OUT="${OUT}${SEP}${DIM}${SESSION}${RESET}"

printf '%b\n' "$OUT"
