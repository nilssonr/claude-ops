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
      additionalContext: `[Hook: plan-to-implement] MANDATORY: When this plan is approved, you MUST spawn a single general-purpose orchestrator agent to execute it. Do NOT implement the plan yourself — delegate entirely.

Spawn the agent using:
  Agent tool:
    subagent_type: "general-purpose"
    description: "Orchestrate plan implementation"
    prompt: (see below)

The orchestrator agent prompt MUST include:
1. The plan file path: ${planFile}
2. These constraints:
   - Read the plan file first. Understand ALL steps before spawning anything.
   - Identify which steps can run in parallel vs which have dependencies.
   - For each independent work stream, spawn a claude-ops:developer agent with isolation: "worktree" and mode: "bypassPermissions".
   - Run independent streams in parallel. Run dependent streams sequentially after their dependencies complete.
   - Each plan step contains a self-contained context package (spec requirements, code excerpts, file paths). When spawning a developer agent, include the FULL step content in the agent's prompt — do NOT summarize or omit code excerpts.
   - Developer agents should NOT do broad codebase exploration (Glob/Grep across the whole repo). The plan step gives them exact files and existing code. They read only the specific files listed in their step.
   - If the plan header references a spec file path, read and include it in the orchestrator's context for requirement consultation during execution.
   - After all agents finish, collect the worktree branch names from their results.
   - Merge each branch into the current branch using: git merge <branch> --no-ff
   - If a merge conflict occurs, STOP merging. Report the conflict (files, branches) and do NOT attempt to resolve it.
   - After merging, report a summary: which groups succeeded, which failed, commit list, and suggested next steps.
3. Tell the orchestrator to use its own judgment for grouping and parallelization — do NOT require any rigid plan format.`,
    },
  }),
);
