import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// PreToolUse hook for ExitPlanMode
// Injects orchestration constraints telling Claude to spawn a single
// general-purpose agent that reads the plan and coordinates developer
// agents in isolated worktrees.

const input = JSON.parse(await Bun.stdin.text());

if (input?.tool_name !== "ExitPlanMode") process.exit(0);

const planDir = join(homedir(), ".claude", "plans");

let planFile: string | undefined;
try {
  const entries = readdirSync(planDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: f, mtime: statSync(join(planDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (entries.length > 0) {
    planFile = join(planDir, entries[0].name);
  }
} catch {
  // No plan directory or read error — skip injection
  process.exit(0);
}

if (!planFile) process.exit(0);

// Return PreToolUse additionalContext — this persists in Claude's context
// and will be visible when Claude decides what to do after plan approval
console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: `[Hook: plan-to-implement] MANDATORY: When this plan is approved, you MUST orchestrate it yourself by spawning developer agents directly. Do NOT delegate to an intermediary agent.

Implementation steps:
1. Read the plan file at ${planFile}. Understand ALL steps before spawning anything.
2. If the plan header references a spec file path, read it for requirement context.
3. Group steps by dependencies — identify which can run in parallel vs sequentially.
4. For each step, spawn a claude-ops:developer agent with isolation: "worktree", mode: "bypassPermissions", and run_in_background: true.
5. Each plan step contains a self-contained context package (spec requirements, code excerpts, file paths). Include the FULL step content in each agent's prompt — do NOT summarize or omit code excerpts.
6. Developer agents should NOT do broad codebase exploration (Glob/Grep across the whole repo). The plan step gives them exact files and existing code.
7. Wait for background agent notifications — do NOT poll with TaskOutput.
8. After all agents complete, merge each worktree branch into the current branch: git merge <branch> --no-ff
9. If a merge conflict occurs, STOP merging. Report the conflict (files, branches) and do NOT attempt to resolve it.
10. Report a summary: which steps succeeded, which failed, commit list, and suggested next steps.`,
    },
  }),
);
