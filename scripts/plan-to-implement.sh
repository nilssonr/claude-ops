#!/bin/bash
# PreToolUse hook for ExitPlanMode
# Injects orchestration constraints telling Claude to spawn a single
# general-purpose agent that reads the plan and coordinates developer
# agents in isolated worktrees.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')

# Only act on ExitPlanMode
if [ "$TOOL_NAME" != "ExitPlanMode" ]; then
  exit 0
fi

# Find the most recent plan file
PLAN_DIR="$HOME/.claude/plans"
PLAN_FILE=$(ls -t "$PLAN_DIR"/*.md 2>/dev/null | head -1)

if [ -z "$PLAN_FILE" ]; then
  # No plan file found — skip injection
  exit 0
fi

# Return PreToolUse additionalContext — this persists in Claude's context
# and will be visible when Claude decides what to do after plan approval
jq -n \
  --arg plan_file "$PLAN_FILE" \
  '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: ("[Hook: plan-to-implement] MANDATORY: When this plan is approved, you MUST spawn a single general-purpose orchestrator agent to execute it. Do NOT implement the plan yourself — delegate entirely.\n\nSpawn the agent using:\n  Agent tool:\n    subagent_type: \"general-purpose\"\n    description: \"Orchestrate plan implementation\"\n    prompt: (see below)\n\nThe orchestrator agent prompt MUST include:\n1. The plan file path: " + $plan_file + "\n2. These constraints:\n   - Read the plan file first. Understand ALL steps before spawning anything.\n   - Identify which steps can run in parallel vs which have dependencies.\n   - For each independent work stream, spawn a claude-ops:developer agent with isolation: \"worktree\" and mode: \"bypassPermissions\".\n   - Run independent streams in parallel. Run dependent streams sequentially after their dependencies complete.\n   - After all agents finish, collect the worktree branch names from their results.\n   - Merge each branch into the current branch using: git merge <branch> --no-ff\n   - If a merge conflict occurs, STOP merging. Report the conflict (files, branches) and do NOT attempt to resolve it.\n   - After merging, report a summary: which groups succeeded, which failed, commit list, and suggested next steps.\n3. Tell the orchestrator to use its own judgment for grouping and parallelization — do NOT require any rigid plan format.")
    }
  }'
