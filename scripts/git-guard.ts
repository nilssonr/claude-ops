import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

try {
  const input = JSON.parse(await Bun.stdin.text());
  const command: string = input?.tool_input?.command ?? "";
  if (!command) process.exit(0);

  const CONVENTIONAL_RE =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?!?:\s.+$/;
  const BRANCH_RE = /^(feat|fix|docs|refactor|test|chore|ci|perf)\/.+$/;

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

  function block(message: string): never {
    process.stderr.write(message);
    process.exit(2);
  }

  function injectContext(context: string): never {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: context,
        },
      }),
    );
    process.exit(0);
  }

  // === BLOCKING CHECKS ===

  // Broad staging
  if (
    /git\s+add\s+-A\b/.test(command) ||
    /git\s+add\s+\.(\s|$)/.test(command)
  ) {
    block(
      "Broad staging not allowed. Stage specific files: git add path/to/file",
    );
  }

  // Branch naming
  const checkoutBranch = command.match(/git\s+checkout\s+-b\s+(\S+)/);
  const switchBranch = command.match(/git\s+switch\s+-c\s+(\S+)/);
  const worktreeBranch = command.match(/git\s+worktree\s+add\s+.*-b\s+(\S+)/);
  const newBranch =
    checkoutBranch?.[1] ?? switchBranch?.[1] ?? worktreeBranch?.[1];
  if (newBranch && !BRANCH_RE.test(newBranch)) {
    block(
      `Branch name must match type/short-description. Got: '${newBranch}'. Example: feat/add-auth`,
    );
  }

  // Commit checks
  if (/git\s+commit\b/.test(command)) {
    // Amend after push
    if (/--amend/.test(command)) {
      const r = spawnSync("git", ["log", "@{upstream}..HEAD", "--oneline"], {
        encoding: "utf-8",
      });
      if (r.status === 0 && r.stdout?.trim() === "") {
        block("Cannot amend pushed commits. Create a new commit instead.");
      }
    }

    // Default branch protection
    const current = getCurrentBranch();
    const defaultBranch = getDefaultBranch();
    if (current === defaultBranch && !isMainCommitsAllowed()) {
      block(
        `Cannot commit to ${current} (default branch). Create a feature branch first.`,
      );
    }

    // Commit message format
    let subject: string | null = null;
    // Try heredoc-in-subshell first: -m "$(cat <<'EOF' ... EOF )"
    const catHeredoc = command.match(
      /-m\s+"\$\(cat\s+<<['"]?(\w+)['"]?\n([\s\S]*?)\n\s*\1/,
    );
    // Bare heredoc: -m <<'EOF' ... EOF
    const bareHeredoc = command.match(
      /-m\s+<<['"]?(\w+)['"]?\n([\s\S]*?)\n\s*\1/,
    );
    // Single-line quotes (exclude newlines so they don't swallow heredocs)
    const doubleQuoteMsg = command.match(/-m\s+"([^"\n]+)"/);
    const singleQuoteMsg = command.match(/-m\s+'([^'\n]+)'/);
    if (catHeredoc) {
      subject = catHeredoc[2].split("\n")[0].trim();
    } else if (bareHeredoc) {
      subject = bareHeredoc[2].split("\n")[0].trim();
    } else if (doubleQuoteMsg) {
      subject = doubleQuoteMsg[1];
    } else if (singleQuoteMsg) {
      subject = singleQuoteMsg[1];
    }

    if (subject && !CONVENTIONAL_RE.test(subject)) {
      block(
        `Commit message doesn't match conventional format. Expected: type(scope): description. Got: '${subject}'`,
      );
    }
  }

  // Push to default branch
  if (/git\s+push\b/.test(command)) {
    const current = getCurrentBranch();
    const defaultBranch = getDefaultBranch();
    if (current === defaultBranch && !isMainCommitsAllowed()) {
      block(`Cannot push to ${current} (default branch).`);
    }
  }

  // PR title
  const prTitleDouble = command.match(
    /gh\s+pr\s+create\s+.*--title\s+"([^"]+)"/,
  );
  const prTitleSingle = command.match(
    /gh\s+pr\s+create\s+.*--title\s+'([^']+)'/,
  );
  const prTitle = prTitleDouble?.[1] ?? prTitleSingle?.[1];
  if (prTitle && !CONVENTIONAL_RE.test(prTitle)) {
    block(
      `PR title doesn't match conventional format. Expected: type(scope): description. Got: '${prTitle}'`,
    );
  }

  // === CONTEXT INJECTION ===

  // Force push warning
  if (/git\s+push\b/.test(command) && /(--force\b|\s-f\b)/.test(command)) {
    injectContext("Force push detected. This rewrites remote history.");
  }

  // Git reads
  if (/git\s+(status|diff|log|show)\b/.test(command)) {
    injectContext(
      "Git conventions: conventional commits (type(scope): desc), explicit file staging (no -A/.), one concern per commit. Run `bun run scripts/suggest-commit.ts` for type/scope suggestions.",
    );
  }

  process.exit(0);
} catch {
  process.exit(0);
}
