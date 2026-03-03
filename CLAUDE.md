allow-main-commits: true

## Scripts

- Use TypeScript for all helper scripts — never bash or Python
- Run with `bun run scripts/your-script.ts`
- Use `Bun.stdin.text()` + `JSON.parse()` for hook stdin (not jq)
- Use `spawnSync` from `node:child_process` for subprocess calls

### Hook protocol

- **Stdin**: JSON with `tool_name` (string) and `tool_input` (object). PostToolUse also includes `tool_response`.
- **Exit 0**: Hook succeeded. Stdout is parsed (PreToolUse) or informational (PostToolUse).
- **Exit 2**: Block the tool call (PreToolUse only). Stderr is shown to Claude.
- **`|| exit 0`**: Always use this in `hooks.json` commands as a safety net so a crashed script never blocks the user.
- **PreToolUse stdout**: To inject context, print JSON: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"..."}}`
- **PostToolUse stdout**: Informational only. Keep silent on success.
