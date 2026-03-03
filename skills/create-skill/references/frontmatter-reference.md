# Skill Frontmatter Reference

Complete reference for every YAML frontmatter field available in Claude Code SKILL.md files.

---

## Required Fields

### `name`

- **Type**: `string`
- **Required**: Yes
- **Description**: Machine-readable identifier for the skill. Used in CLI invocation (`/name`) and internal routing.
- **Format**: lowercase, hyphen-separated. No spaces, underscores, or uppercase.
- **Example**: `name: react-typescript`
- **Tips**:
  - Keep it short (1-3 words).
  - Make it memorable and descriptive of the domain.
  - Avoid generic names like `helper` or `utils` — they collide easily and don't communicate purpose.

### `description`

- **Type**: `string` (multi-line with `>-`)
- **Required**: Yes
- **Description**: Full description of the skill's purpose, domain, and activation conditions. This is what Claude reads to decide whether to invoke the skill automatically.
- **Format**: Use `>-` for multi-line YAML strings. Must include TRIGGER and DO NOT TRIGGER clauses.
- **Example**:
  ```yaml
  description: >-
    React + TypeScript expert guidance covering best practices, performance,
    accessibility, component architecture, idiomatic patterns, and common anti-patterns.
    TRIGGER when: writing, reviewing, or refactoring React components in TypeScript
    (.tsx/.ts files), discussing React patterns, or implementing features in a React project.
    DO NOT TRIGGER when: working on non-React code, pure Node.js/backend code, or
    configuration files unrelated to React.
  ```
- **Tips**:
  - First sentence: what the skill IS (third-person, declarative).
  - TRIGGER when: specific, observable conditions (file types, keywords, user actions).
  - DO NOT TRIGGER when: explicit exclusions to prevent false activations.
  - Use concrete signals: file extensions, tool names, library names, user phrases.

### `user-invocable`

- **Type**: `boolean`
- **Required**: Yes (in practice)
- **Description**: Whether users can invoke this skill directly via `/skill-name` in the CLI.
- **Example**: `user-invocable: true`
- **Tips**:
  - Set `true` for skills users should call directly (most skills).
  - Set `false` for skills that should only activate via model auto-detection.

---

## Optional Fields

### `argument-hint`

- **Type**: `string`
- **Required**: No
- **Description**: Hint text shown in autocomplete after the skill name. Tells users what arguments the skill accepts.
- **Format**: Short phrase in brackets or plain text describing expected input.
- **Example**: `argument-hint: "[topic] or audit [skill-name]"`
- **Tips**:
  - Use brackets for placeholders: `[url]`, `[file-path]`, `[topic]`.
  - Separate multiple argument forms with `or`.
  - Keep it under 60 characters for clean display.

### `allowed-tools`

- **Type**: `string` (comma-separated list)
- **Required**: No (defaults to all tools)
- **Description**: Tools that Claude can use **without asking permission** when this skill is active. This is an auto-approve list, not a restriction — tools not listed still work but require normal permission approval.
- **Example**: `allowed-tools: Read, Grep, Glob, Edit, Write, Bash`
- **Common tool sets**:

  | Use Case           | Tools                                                      |
  | ------------------ | ---------------------------------------------------------- |
  | Read-only analysis | `Read, Grep, Glob`                                         |
  | Code modification  | `Read, Grep, Glob, Edit, Write, Bash`                      |
  | Research           | `Read, Grep, Glob, Bash, WebSearch, WebFetch`              |
  | Full generation    | `Read, Grep, Glob, Edit, Write, Bash, WebSearch, WebFetch` |

- **Tips**:
  - Principle of least privilege: only include tools the skill actually needs.
  - Include `Read, Grep, Glob` as baseline for any skill that references code.
  - Include `WebSearch, WebFetch` only if the skill needs online research.
  - **NEVER include `AskUserQuestion`, `EnterPlanMode`, or `ExitPlanMode`.** These are interactive/UI tools that require user input. Listing them in `allowed-tools` causes auto-approval which skips the user prompt entirely, returning empty results. They are always available without being listed.

### `disable-model-invocation`

- **Type**: `boolean`
- **Required**: No (defaults to `false`)
- **Description**: When `true`, prevents Claude from auto-invoking this skill based on context. The skill can only be triggered by explicit user command (`/skill-name`).
- **Example**: `disable-model-invocation: true`
- **Tips**:
  - Use for skills with destructive or expensive operations.
  - Use for skills that overlap with many contexts and would fire too often.

### `model`

- **Type**: `string`
- **Required**: No
- **Description**: Override the model used when this skill is active. Useful for cost optimization (simpler skills on cheaper models) or capability requirements (complex skills on more capable models).
- **Example**: `model: claude-sonnet-4-6`
- **Tips**:
  - Only override if there's a strong reason (cost, capability).
  - Most skills work fine with the default model.

### `context`

- **Type**: `string` or `array`
- **Required**: No
- **Description**: Additional files or directories to load into context when the skill activates. Paths are relative to the skill directory.
- **Example**: `context: references/best-practices.md`
- **Tips**:
  - Use for reference material the skill needs in every invocation.
  - Keep context files concise — they consume context window.
  - Prefer having the skill Read files on-demand instead of loading everything upfront.
  - Use for small, always-needed references (< 200 lines).

### `agent`

- **Type**: `object`
- **Required**: No
- **Description**: Configures the skill to run as an agent subprocess rather than inline.
- **Fields**: `type`, `model`, `tools`, `max-turns`
- **Tips**:
  - Use for long-running, multi-step skills that benefit from isolation.
  - Most skills do NOT need this — inline execution is simpler and faster.

### `hooks`

- **Type**: `object`
- **Required**: No
- **Description**: Define hook points that run shell commands at specific lifecycle events within the skill.
- **Tips**:
  - Use for validation, linting, or post-processing after skill execution.
  - Keep hooks fast — they block execution.

### `version`

- **Type**: `string` (semver)
- **Required**: No
- **Description**: Version of the skill for tracking changes.
- **Example**: `version: 1.0.0`
- **Tips**:
  - Useful for plugins distributed to multiple users.
  - Follow semver: breaking changes = major, new features = minor, fixes = patch.
