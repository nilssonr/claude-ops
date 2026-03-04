# claude-ops

Skills, agents, and hooks for Claude Code.

## Skills

| Skill                | Command                 | Description                                                                                                                |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| brainstorm           | `/brainstorm`           | Requirements gathering and spec writing through guided interview                                                           |
| interface-design     | `/interface-design`     | Craft-driven interface design for dashboards, apps, and tools — with domain exploration, design systems, and self-critique |
| create-skill         | `/create-skill`         | Create and audit Claude Code skills with guided interview, domain research, and quality validation                         |
| react-typescript     | `/react-typescript`     | React + TypeScript best practices, performance, accessibility, architecture, and code quality                              |
| storybook-components | `/storybook-components` | Storybook, shadcn/ui, Tailwind v4, CVA variants, compound components, and tweakcn                                          |
| tdd                  | `/tdd`                  | Test-driven development: testability assessment, RED-GREEN-REFACTOR, anti-pattern enforcement                              |
| troubleshoot         | `/troubleshoot`         | Hypothesis-driven debugging: phased investigation, 2-strike escalation, root cause analysis                                |
| review               | `/review`               | Code review orchestrator: splits diffs by domain, spawns parallel reviewers, consolidates findings                         |

## Agents

| Agent             | Description                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| code-reviewer     | Self-contained code review: 11-dimension framework, confidence scoring, severity reports            |
| hercule-poirot    | Autonomous investigation agent: verifies claims via subagent research, confidence scoring, verdicts |
| skill-generator   | Generates skill packages from interview results — delegated by create-skill                         |
| component-builder | Builds UI components from an established design system — delegated by interface-design              |
| developer         | Implements plan steps with TDD — spawned by post-plan orchestrator in isolated worktrees            |

## Hooks

| Hook              | Type                      | Description                                                                             |
| ----------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| git-guard         | PreToolUse (Bash)         | Enforces conventional commits, branch naming, branch protection, and staging discipline |
| auto-format       | PostToolUse (Write, Edit) | Runs appropriate formatter after file modifications                                     |
| plan-to-implement | PreToolUse (ExitPlanMode) | Injects orchestration constraints for post-plan execution                               |

## Interface Design

The `interface-design` skill pushes Claude past generic UI output by forcing domain exploration, intentional design choices, and self-critique before showing results.

### Sub-commands

| Command                            | What it does                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `/interface-design init`           | Start building UI — explores the product domain, proposes a direction, builds with craft |
| `/interface-design audit <path>`   | Check code against your design system for spacing, depth, color, and pattern violations  |
| `/interface-design critique`       | Self-critique the last build and rebuild what defaulted                                  |
| `/interface-design extract <path>` | Extract patterns from existing code into a `system.md`                                   |
| `/interface-design status`         | Show current design system tokens and patterns                                           |

### How it works

1. **Domain exploration** — Before picking colors or layouts, the skill explores the product's world: concepts, metaphors, natural colors, and a signature element unique to the product.
2. **Default rejection** — Names 3 obvious/generic choices, then explicitly replaces each one.
3. **Design system persistence** — Saves decisions to `.interface-design/system.md` so future sessions stay consistent.
4. **Self-critique loop** — Runs swap, squint, signature, and token tests before showing output.

### Typical workflow

```
# Starting a new project UI
/interface-design init

# After building, critique and refine
/interface-design critique

# Extract patterns from existing code
/interface-design extract src/components

# Audit for design system violations
/interface-design audit src/components
```

The skill also triggers automatically when you ask Claude to build dashboards, admin panels, or app interfaces.

## Plan Implementation

When a plan is approved via ExitPlanMode, the `plan-to-implement` hook automatically injects orchestration constraints into the session. The main session spawns a single `general-purpose` orchestrator agent that reads the plan, identifies parallelizable work, and delegates to `developer` agents in isolated worktrees.

### Flow

```
brainstorm → plan mode → plan file → approve → hook injects constraints
  → orchestrator agent spawns → reads plan → spawns developer agents → merge
```

### How it works

1. **Hook injection** — The `plan-to-implement` hook fires on ExitPlanMode and injects the plan file path plus orchestration constraints into the session context.
2. **Orchestrator spawn** — The main session spawns a single `general-purpose` agent with the plan file path and constraints. This keeps orchestration noise out of the main context window.
3. **Parallel execution** — The orchestrator reads the plan, uses its own judgment to identify parallel vs sequential work, and spawns `claude-ops:developer` agents with `isolation: "worktree"` for each work stream.
4. **Merge** — After all agents finish, worktree branches are merged back with `--no-ff`. Conflicts are reported, never auto-resolved.

### Plan format

No rigid format is required. The orchestrator reads any plan and judges parallelization itself. Write plans naturally — describe what needs to happen, note dependencies where they exist, and let the orchestrator figure out the execution order.

## Statusline

A custom statusline that shows model, git branch, working directory, and session ID:

```
Claude Opus 4.6 | feat/my-feature | ~/Code/my-project | abc123
```

### Setup

1. Copy the statusline script:

```bash
cp scripts/statusline.sh ~/.claude/statusline.sh
chmod +x ~/.claude/statusline.sh
```

2. Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

## Installation

```bash
claude --plugin-dir /path/to/claude-ops
```

## Development

### Testing the plugin locally

```bash
claude --plugin-dir .
```

### Adding a new skill

1. Create a directory under `skills/` with your skill name
2. Add a `SKILL.md` file with YAML frontmatter and markdown instructions
3. Optionally add supporting files (reference docs, templates, scripts)

### Adding a new agent

1. Create a markdown file under `agents/` named `<agent-name>.md`
2. Add YAML frontmatter with `name`, `description`, `tools`, and other config
3. Write the agent's system prompt as the markdown body

### Adding a hook

1. Add hook entries to `hooks/hooks.json`
2. For command-type hooks, put scripts in `scripts/` as `.ts` files
3. Reference them with `bun run scripts/your-script.ts`

## Plugin Structure

```
claude-ops/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/                  # Skill definitions (SKILL.md + supporting files)
├── agents/                  # Custom subagent definitions
├── commands/                # Simple slash commands
├── hooks/                   # Hook configurations
│   └── hooks.json
├── scripts/                 # Utility scripts for hooks
├── .mcp.json                # MCP server definitions
├── .lsp.json                # LSP server definitions
├── settings.json            # Plugin settings
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## License

MIT
