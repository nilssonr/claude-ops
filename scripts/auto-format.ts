import { spawnSync } from "node:child_process";

// Auto-Format Hook — runs the appropriate formatter after Write/Edit tool calls.
//
// PostToolUse hook that reads the tool result from stdin, extracts the file path,
// and runs the matching formatter. Silent on success, skips gracefully if the
// formatter is not installed.

const input = JSON.parse(await Bun.stdin.text());
const filePath: string = input?.tool_input?.file_path ?? "";

if (!filePath) process.exit(0);

const file = Bun.file(filePath);
if (!(await file.exists())) process.exit(0);

const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

switch (ext) {
  case "ts":
  case "tsx":
  case "js":
  case "jsx":
  case "json":
  case "css":
  case "md":
    spawnSync("npx", ["prettier", "--write", filePath], { stdio: "ignore" });
    break;
  case "go":
    spawnSync("gofmt", ["-w", filePath], { stdio: "ignore" });
    break;
  case "rs":
    spawnSync("rustfmt", [filePath], { stdio: "ignore" });
    break;
  case "py": {
    const ruff = spawnSync("ruff", ["format", filePath], { stdio: "ignore" });
    if (ruff.status !== 0) {
      spawnSync("black", ["--quiet", filePath], { stdio: "ignore" });
    }
    break;
  }
}
