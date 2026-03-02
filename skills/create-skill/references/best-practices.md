# Skill Authoring Best Practices

Conventions, guidelines, and quality standards for writing high-quality Claude Code skills.

---

## 1. Description Writing

### Structure

The `description` field is the most important field for automatic skill activation. Claude reads it to decide whether to invoke the skill.

**Formula**: `[What it is] + [What it covers] + TRIGGER when + DO NOT TRIGGER when`

### Rules

- Write in **third person, declarative voice**: "Expert guidance covering..." not "I will help you with..."
- Be **specific about trigger conditions**: file types, keywords, user actions, library names.
- Include **explicit exclusions** to prevent false positives.
- Use **observable signals**, not intent: "working with .tsx files" not "when the user wants React help."

### Trigger Terms

Good trigger terms are concrete and observable:

| Strong Triggers | Weak Triggers |
|----------------|---------------|
| `.tsx` files, `import React` | "React project" |
| `user says "brainstorm"` | "user wants help" |
| `writing stories`, `.stories.tsx` | "component work" |
| `Storybook`, `shadcn/ui` | "UI library" |

### Anti-Patterns

- **Too broad**: "Helps with web development" — fires on everything.
- **Too narrow**: "Only for React 18.2.0 with TypeScript 5.3" — misses valid contexts.
- **Missing DO NOT TRIGGER**: Without exclusions, overlapping skills fight for activation.
- **Vague triggers**: "When the user needs help" — everything matches.

---

## 2. Content Structure

### Announcement

Every skill MUST start with:

```markdown
**Announce to the user: "Skill activated: [skill-name]"**
```

This makes skill activation visible and helps users understand which skill is active.

### Title & Role Statement

After the announcement:

```markdown
# [Skill Name] — [Brief Tagline]

You are [role description]. [What you do]. [Core constraint or philosophy].
```

The role statement sets Claude's persona and boundaries for the skill session.

### Section Organization

- Use **numbered top-level sections** (`## 1.`, `## 2.`, etc.) for major topics.
- Use **### subsections** for related sub-topics.
- Use **tables** for decision frameworks, comparisons, and quick-reference lookups.
- Use **code blocks** for patterns, templates, and examples.
- Use **checklists** for verification steps.

### Progressive Disclosure

Structure content from most-used to least-used:

1. **Core rules** — the 3-5 things that matter most (top of the skill).
2. **Patterns & examples** — how to apply the rules (middle).
3. **Edge cases & anti-patterns** — what to avoid (later sections).
4. **Checklists & references** — verification and lookup (end).

This ensures Claude hits the most important content first, even if context is limited.

---

## 3. Content Quality

### Degrees of Freedom

Every rule should have a clear **degree of freedom** — how much latitude Claude has:

| Marker | Meaning | Example |
|--------|---------|---------|
| **MUST** / **Always** / **Never** | No flexibility — hard rule | "Never use `any` types" |
| **Prefer** / **Default to** | Use unless there's a clear reason not to | "Prefer composition over inheritance" |
| **Consider** / **When practical** | Optional, context-dependent | "Consider virtualization for 100+ items" |

Avoid ambiguous language like "try to" or "it's good practice to" — be prescriptive.

### Code Examples

- **Every pattern should have a code example.** Rules without examples are interpreted inconsistently.
- Use **TypeScript** for type-safe examples where applicable.
- Show **complete, runnable snippets** — not pseudocode fragments.
- Include **both the pattern and the anti-pattern** when the distinction matters.

```markdown
// DO: Use discriminated unions
type Result = { ok: true; data: User } | { ok: false; error: string };

// DON'T: Use optional fields for mutually exclusive states
type Result = { ok?: boolean; data?: User; error?: string };
```

### Anti-Pattern Tables

Use tables to contrast good and bad patterns. This is one of the most effective teaching formats:

```markdown
| Don't do this | Do this instead | Why |
|---------------|----------------|-----|
| `useEffect` for derived state | Compute during render | Avoids extra render cycle |
| Array index keys on dynamic lists | Stable unique IDs | Prevents reorder bugs |
```

### Grounded, Not Opinionated

- Base recommendations on **official documentation**, **framework team guidance**, or **measurable outcomes**.
- Avoid personal preferences. Instead of "I recommend X," write "X because [observable reason]."
- When multiple approaches are valid, present a **decision framework** (table with criteria) instead of picking one.

---

## 4. Tool Usage

### Principle of Least Privilege

Only request tools the skill actually needs. Common patterns:

| Skill Type | Typical Tools |
|-----------|---------------|
| Knowledge/guidance (like react-typescript) | `Read, Grep, Glob, Edit, Write, Bash` |
| Interview/planning (like brainstorm) | `Read, Grep, Glob, Bash, WebSearch, WebFetch, AskUserQuestion, EnterPlanMode` |
| Code generation (like create-skill) | `Read, Grep, Glob, Edit, Write, Bash, WebSearch, WebFetch, AskUserQuestion` |
| Audit/analysis | `Read, Grep, Glob` |

### Tool Scoping Tips

- `WebSearch` + `WebFetch` — only if the skill needs to research external information.
- `AskUserQuestion` — only if the skill has an interactive interview or decision phase.
- `EnterPlanMode` — only if the skill transitions to plan mode as a final step.
- `Edit` + `Write` — only if the skill creates or modifies files.
- `Bash` — only if the skill needs to run shell commands (tests, builds, etc.).

---

## 5. Size & Complexity

### The 500-Line Guideline

SKILL.md files should stay **under 500 lines**. Beyond that:

- Claude may not process the full content reliably.
- Maintenance becomes difficult.
- The skill is likely trying to do too much.

### When You Exceed 500 Lines

1. **Extract reference material** into `references/` files that the skill reads on-demand.
2. **Extract templates** into `templates/` files.
3. **Split the skill** into focused sub-skills if the domains are separable.

### Supporting File Conventions

```
skills/my-skill/
├── SKILL.md                    # Main skill (< 500 lines)
├── references/
│   ├── api-reference.md        # Detailed reference material
│   └── patterns.md             # Pattern library
└── templates/
    └── component-template.md   # Templates for generation
```

- Reference files are read on-demand by the skill, not loaded into context automatically.
- Keep reference files focused on a single topic.
- Use descriptive filenames — they're part of the skill's documentation.

---

## 6. Testing Guidelines

### Manual Testing

1. **Invoke directly**: `/skill-name [args]` — verify activation and argument handling.
2. **Test empty args**: `/skill-name` — verify graceful handling or prompting.
3. **Test auto-activation**: Work in the skill's domain without invoking — verify it activates when expected.
4. **Test boundaries**: Work in adjacent domains — verify it does NOT activate when excluded.
5. **Test edge cases**: Unusual inputs, missing files, conflicting instructions.

### What to Verify

- [ ] Frontmatter parses without errors
- [ ] Skill announces activation
- [ ] Arguments are parsed and used correctly
- [ ] All referenced files/paths exist and are readable
- [ ] Tool restrictions are appropriate (not too broad, not too narrow)
- [ ] Content is accurate and up-to-date
- [ ] Code examples are syntactically valid
- [ ] Checklists and tables render correctly in markdown
- [ ] Skill stays within its defined scope (doesn't drift to adjacent topics)
- [ ] Skill handles missing or malformed input gracefully

---

## 7. Quality Audit Checklist

Use this checklist to evaluate any skill. Each item scores PASS, WARN, or FAIL.

### Frontmatter Quality

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| F1 | `name` is lowercase-hyphenated, 1-3 words | Correct format | Slightly long | Missing or wrong format |
| F2 | `description` has TRIGGER and DO NOT TRIGGER | Both present and specific | Present but vague | Missing one or both |
| F3 | `description` uses third-person voice | Consistent | Mixed voice | First-person throughout |
| F4 | `user-invocable` is set | Present | — | Missing |
| F5 | `allowed-tools` follows least privilege | Only needed tools | 1-2 unnecessary tools | All tools or missing |
| F6 | `argument-hint` present (if skill takes args) | Clear hint with placeholders | Vague hint | Missing when needed |

### Content Structure

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| S1 | Starts with announcement line | Present and correct | Slightly different format | Missing |
| S2 | Has title + role statement | Clear role and boundaries | Role but no boundaries | Missing |
| S3 | Uses numbered sections | Consistent numbering | Inconsistent | No structure |
| S4 | Progressive disclosure (core → detail → reference) | Clear progression | Somewhat organized | Random order |
| S5 | Under 500 lines | < 400 lines | 400-500 lines | > 500 lines |
| S6 | Supporting files extracted when needed | Properly extracted | Could extract more | > 500 lines, nothing extracted |

### Content Quality

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| Q1 | Rules use clear degrees of freedom (MUST/Prefer/Consider) | Consistent markers | Mostly clear | Ambiguous "try to" language |
| Q2 | Code examples for key patterns | Complete, runnable examples | Pseudocode fragments | No examples |
| Q3 | Anti-pattern tables where relevant | DO/DON'T comparisons | Some comparisons | No anti-pattern guidance |
| Q4 | Grounded in docs/standards, not opinion | Citations or framework refs | Mostly grounded | Pure opinion |
| Q5 | Checklist at the end | Comprehensive checklist | Partial checklist | No checklist |
| Q6 | No factual errors or outdated info | Current and accurate | Minor outdated refs | Major inaccuracies |

### Tool Usage

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| T1 | Tool list matches what skill actually does | Exact match | Minor mismatch | Major mismatch |
| T2 | No unnecessary powerful tools | Minimal set | 1-2 extras | Unrestricted |

### Scoring

- **PASS** = 2 points, **WARN** = 1 point, **FAIL** = 0 points, **N/A** = excluded
- **Score**: sum / (max possible × 2) × 100
- **Thresholds**: ≥ 90% = Excellent, 75-89% = Good, 60-74% = Needs improvement, < 60% = Major issues
