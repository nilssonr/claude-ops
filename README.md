# claude-ops

Skills, agents, and hooks for Claude Code.

## Skills

| Skill                | Command                 | Description                                                                                                                |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| brainstorm           | `/brainstorm`           | Requirements gathering and spec writing through guided interview                                                           |
| interface-design     | `/interface-design`     | Craft-driven interface design for dashboards, apps, and tools — with domain exploration, design systems, and self-critique |
| create-skill         | `/create-skill`         | Create and audit Claude Code skills with guided interview, domain research, and quality validation                         |
| git                  | `/git`                  | Git workflow enforcement: conventional commits, worktrees, logical commit splitting, PR creation, branch protection        |
| react-typescript     | `/react-typescript`     | React + TypeScript best practices, performance, accessibility, architecture, and code quality                              |
| review               | `/review`               | Structured code review: 11-dimension framework, confidence scoring, severity classification                                |
| storybook-components | `/storybook-components` | Storybook, shadcn/ui, Tailwind v4, CVA variants, compound components, and tweakcn                                          |
| tdd                  | `/tdd`                  | Test-driven development: testability assessment, RED-GREEN-REFACTOR, anti-pattern enforcement                              |
| troubleshoot         | `/troubleshoot`         | Hypothesis-driven debugging: phased investigation, 2-strike escalation, root cause analysis                                |

## Hooks

| Hook        | Type                      | Description                                                  |
| ----------- | ------------------------- | ------------------------------------------------------------ |
| git-guard   | PreToolUse (Bash)         | Enforces /git skill for git write operations and gh commands |
| auto-format | PostToolUse (Write, Edit) | Runs appropriate formatter after file modifications          |

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
2. For command-type hooks, put scripts in `scripts/`
3. Make scripts executable: `chmod +x scripts/your-script.sh`

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
