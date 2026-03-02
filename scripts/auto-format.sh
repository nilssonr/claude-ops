#!/bin/bash
# Auto-Format Hook — runs the appropriate formatter after Write/Edit tool calls.
#
# PostToolUse hook that reads the tool result from stdin, extracts the file path,
# and runs the matching formatter. Silent on success, skips gracefully if the
# formatter is not installed.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Exit early if no file path or jq failed
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Extract extension (lowercase)
EXT="${FILE_PATH##*.}"
EXT=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

case "$EXT" in
  ts|tsx|js|jsx|json|css|md)
    npx prettier --write "$FILE_PATH" 2>/dev/null || true
    ;;
  go)
    gofmt -w "$FILE_PATH" 2>/dev/null || true
    ;;
  rs)
    rustfmt "$FILE_PATH" 2>/dev/null || true
    ;;
  py)
    ruff format "$FILE_PATH" 2>/dev/null || black --quiet "$FILE_PATH" 2>/dev/null || true
    ;;
esac

exit 0
