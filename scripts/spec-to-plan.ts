import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// PreToolUse hook for EnterPlanMode
// Finds the most recent spec file under ~/.claude/specs/ and injects it
// into plan mode along with planning instructions that require
// self-contained, context-rich plan steps.

const input = JSON.parse(await Bun.stdin.text());

if (input?.tool_name !== "EnterPlanMode") process.exit(0);

const specsDir = join(homedir(), ".claude", "specs");

// Recursively find all .md files under specsDir
function findMarkdownFiles(dir: string): { path: string; mtime: number }[] {
  const results: { path: string; mtime: number }[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push({ path: fullPath, mtime: statSync(fullPath).mtimeMs });
      }
    }
  } catch {
    // Directory doesn't exist or read error — return empty
  }
  return results;
}

const specFiles = findMarkdownFiles(specsDir).sort(
  (a, b) => b.mtime - a.mtime,
);

if (specFiles.length === 0) process.exit(0);

const specFile = specFiles[0];
const specContent = readFileSync(specFile.path, "utf-8");

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: `[Hook: spec-to-plan] A spec file was found for this planning session.

Spec file: ${specFile.path}

--- SPEC START ---
${specContent}
--- SPEC END ---

PLANNING INSTRUCTIONS: You MUST produce a plan where each step is a self-contained context package. Every plan step MUST include:

1. **spec_requirements**: Which [MUST] and [SHOULD] items from the spec this step addresses (quote them).
2. **depends_on**: Step dependencies (e.g., "Step 1" or "none"). This enables the orchestrator to parallelize independent steps.
3. **files**: Absolute paths of all files this step reads or modifies.
4. **input**: Key code excerpts (10-30 lines) of existing code being modified. Read the actual files and paste the relevant sections. This is critical — workers will use these excerpts instead of re-exploring the codebase.
5. **output**: Expected state after the step — what the code should look like or what behavior should change.
6. **detail**: Implementation guidance — what to add, remove, or change, and why.
7. **tests**: What to verify after this step (commands to run, behavior to check).

COVERAGE CHECK: After writing the plan, verify that every [MUST] requirement from the spec maps to at least one step. List any unmapped [MUST] items and add steps to cover them.`,
    },
  }),
);
