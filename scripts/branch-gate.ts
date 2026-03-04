import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

try {
  const input = JSON.parse(await Bun.stdin.text());
  const filePath: string = input?.tool_input?.file_path ?? "";
  if (!filePath) process.exit(0);

  const cwd = process.cwd();
  if (!filePath.startsWith(cwd)) process.exit(0);

  function getCurrentBranch(): string {
    const r = spawnSync("git", ["branch", "--show-current"], {
      encoding: "utf-8",
    });
    return r.status === 0 ? (r.stdout?.trim() ?? "") : "";
  }

  function getDefaultBranch(): string {
    const r = spawnSync("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], {
      encoding: "utf-8",
    });
    if (r.status === 0 && r.stdout) {
      return r.stdout.trim().replace("refs/remotes/origin/", "");
    }
    return "main";
  }

  function isMainCommitsAllowed(): boolean {
    try {
      const content = readFileSync("CLAUDE.md", "utf-8");
      return /allow-main-commits:\s*true/i.test(content);
    } catch {
      return false;
    }
  }

  const current = getCurrentBranch();
  const defaultBranch = getDefaultBranch();

  if (current === defaultBranch && !isMainCommitsAllowed()) {
    process.stderr.write(
      `Cannot edit project files on ${current} (default branch). Create a feature branch first: git checkout -b feat/your-feature`,
    );
    process.exit(2);
  }

  process.exit(0);
} catch {
  process.exit(0);
}
