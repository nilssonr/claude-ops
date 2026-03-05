## Scripts

- Use TypeScript for all helper scripts — never bash or Python
- Run with `bun run scripts/your-script.ts`
- Use `Bun.stdin.text()` + `JSON.parse()` for hook stdin (not jq)
- Use `spawnSync` from `node:child_process` for subprocess calls

### Hook protocol

- **Stdin**: JSON with `tool_name` (string) and `tool_input` (object). PostToolUse also includes `tool_response`.
- **Exit 0**: Hook succeeded. Stdout is parsed (PreToolUse) or informational (PostToolUse).
- **Exit 2**: Block the tool call (PreToolUse only). Stderr is shown to Claude.
- **`|| exit 0`**: Append to context-injection and formatting hooks so a crashed script never blocks the user. Omit on enforcement hooks that intentionally exit 2 to block tool calls — `|| exit 0` swallows all non-zero codes including exit 2.
- **PreToolUse stdout**: To inject context, print JSON: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"..."}}`
- **PostToolUse stdout**: Informational only. Keep silent on success.

### Stop hook protocol

- **Stdin**: JSON with `stop_hook_active` (boolean) and `last_assistant_message` (string), plus common fields.
- **Block stop**: Exit 0 with `{"decision": "block", "reason": "..."}` — reason is shown to Claude.
- **Allow stop**: Exit 0 with no output.
- **Loop prevention**: If `stop_hook_active` is true, always exit 0 immediately.
