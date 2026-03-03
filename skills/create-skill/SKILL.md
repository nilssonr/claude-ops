---
name: create-skill
description: >-
  Creates high-quality Claude Code skills through guided interview, domain research,
  and automated generation. Also audits existing skills against quality standards.
  TRIGGER when: the user says "create a skill", "make a skill", "new skill", "audit skill",
  or invokes /create-skill with a topic or "audit" argument.
  DO NOT TRIGGER when: the user is working within an existing skill, editing SKILL.md files
  directly, or discussing skills conceptually without wanting to create or audit one.
user-invocable: true
argument-hint: "[topic] or audit [skill-name]"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, WebSearch, WebFetch
---

**Announce to the user: "Skill activated: create-skill"**

# Create Skill — Skill Authoring & Auditing

You are an expert Claude Code skill author. You create production-quality skills by combining
deep knowledge of skill authoring best practices with domain expertise. When your domain
confidence is below threshold, you research online before generating.

You operate in two modes based on `$ARGUMENTS`:

- **Create mode** (default): Generate a complete skill package from a topic.
- **Audit mode**: Evaluate an existing skill against quality standards.

Input: $ARGUMENTS

---

## Mode Detection

Parse `$ARGUMENTS` to determine mode:

```
$ARGUMENTS
  ├── starts with "audit " → AUDIT MODE (extract skill name after "audit ")
  ├── empty/blank          → CREATE MODE (ask user for topic first)
  └── anything else        → CREATE MODE (use as topic)
```

If **audit mode**, go to **Phase A1**.
If **create mode**, go to **Phase C1**.

---

# Create Mode

## Phase C1: Domain Interview

Gather enough information to generate a high-quality skill. Use AskUserQuestion with
2-4 focused questions per round. Aim for 1-2 rounds total.

### Round 1 — Core Questions

Ask about:

1. **Purpose & audience**: What is this skill for? Who uses it? What level of expertise
   should the skill assume?
2. **Key topics**: What are the 3-5 most important topics or sections the skill should cover?
3. **Tools & versions**: Which specific tools, frameworks, libraries, or versions should
   the skill target? (e.g., "React 19", "Tailwind v4", "Python 3.12")
4. **Anti-patterns**: What are common mistakes in this domain that the skill should warn about?

### Round 2 — Refinement (if needed)

If Round 1 reveals complexity, ask about:

1. **Scope boundaries**: What is explicitly out of scope? Where should the skill stop and
   another skill begin?
2. **Degree of freedom**: Should the skill be highly prescriptive (MUST/NEVER) or more
   advisory (Prefer/Consider)?
3. **Code examples**: Are there specific patterns or code examples that MUST be included?
4. **Existing conventions**: Does the project already have patterns the skill should respect?

### Exploring for Context

Before or during the interview, search the codebase for relevant context:

- Read any CLAUDE.md for project conventions.
- Search for existing skills in the same domain (potential overlap or conflict).
- Look for code patterns that inform the skill's recommendations.

---

## Phase C2: Confidence Assessment

After gathering requirements, assess your confidence in generating accurate content for
each planned section. Use this anchored rubric:

| Score | Meaning                                                                          |
| ----- | -------------------------------------------------------------------------------- |
| 10    | I could write this from authoritative documentation I know thoroughly            |
| 9     | I am highly confident; minor details might benefit from verification             |
| 8     | Confident on the main points; some specifics (APIs, flags, syntax) are uncertain |
| 7     | General understanding; several details need verification                         |
| 5-6   | Partial knowledge; would likely make errors without research                     |
| 1-4   | Unfamiliar territory; research is essential                                      |

### Assessment Process

1. List each planned section with its confidence score.
2. **Aggregate score = minimum across all sections** (one weak section makes the whole skill unreliable).
3. Display the assessment transparently to the user:

```
Confidence Assessment:
  Section 1: [Topic] — 10/10
  Section 2: [Topic] — 9/10
  Section 3: [Topic] — 7/10  ← triggers research
  Section 4: [Topic] — 10/10
  Aggregate: 7/10 (minimum)
  Threshold: 9/10
  Action: Online research needed for Section 3
```

### Decision

- **Aggregate ≥ 9**: Proceed to Phase C4 (generation).
- **Aggregate < 9**: Proceed to Phase C3 (research).

---

## Phase C3: Online Research (Conditional)

Triggered when any section scores below 9. Research only the sections that need it.

### Research Strategy

1. **Official docs first**: Search for official documentation, API references, and
   framework guides using WebSearch.
2. **Fetch and extract**: Use WebFetch to read the most relevant pages. Extract specific
   facts: API signatures, configuration options, version-specific changes, recommended patterns.
3. **Community sources second**: If official docs are insufficient, search for well-regarded
   blog posts, conference talks, or RFC documents.
4. **Verify conflicting information**: If sources disagree, prefer official docs > framework
   team blog posts > community sources.

### Research Template

For each section needing research:

```
Researching: [Section topic]
  Current confidence: [X]/10
  Gap: [What specifically is uncertain]
  Search queries:
    1. "[framework] [topic] official documentation [year]"
    2. "[framework] [topic] best practices"
    3. "[specific API or feature] migration guide"
  Findings: [Summarize key facts discovered]
  Updated confidence: [Y]/10
```

### After Research

- Re-assess confidence for all researched sections.
- If any section is still below 7 after research, warn the user:

```
Warning: After research, the following sections remain below confidence threshold:
  - [Section]: [X]/10 — [Reason: e.g., "Rapidly changing API, no stable docs yet"]

Options:
  1. Proceed anyway (skill will note uncertainty in those sections)
  2. Exclude those sections from the skill
  3. Provide your own expertise for those sections
```

Use AskUserQuestion to let the user decide.

---

## Phase C4: Delegate to skill-generator Agent

Generation is handled by the `skill-generator` agent. Delegate the work now.

### Pre-Delegation Check

1. **Name collision**: Use Glob to check if `skills/[skill-name]/` already exists.
   - If it exists, ask the user: Overwrite, rename, or audit the existing skill instead?

### Delegate

Spawn the `skill-generator` agent with this context:

```
Skill name: [name from interview]
Description: [from interview answers]
Interview answers: [summarize all C1 answers]
Confidence assessment: [from C2]
Research findings: [from C3, if applicable]
```

The agent handles: file generation, self-audit, quality checks, and README update.
Wait for the agent to return results, then present them to the user.

---

# Audit Mode

## Phase A1: Load and Run Audit Script

1. **Locate the skill**: Use Glob to find `skills/[skill-name]/SKILL.md`.
   - If not found, list all available skills and ask the user to choose.
2. **Run the audit script** to mechanically check structural quality:

```bash
bun run [base_directory]/scripts/audit.ts skills/[skill-name]/SKILL.md
```

The script checks F1-F6, S1-S3, S5-S6, Q1-Q3, Q5, T1, T3 mechanically and outputs JSON:

```json
{
  "path": "skills/tdd/SKILL.md",
  "line_count": 270,
  "results": [
    { "id": "F1", "check": "name format", "status": "PASS", "detail": "tdd" },
    { "id": "Q4", "check": "grounded in docs", "status": "SKIPPED", "detail": "requires LLM judgment" }
  ],
  "score": { "pass": 14, "warn": 2, "fail": 1, "skipped": 3, "percentage": 83 },
  "rating": "Good"
}
```

---

## Phase A2: Evaluate SKIPPED Items

The audit script marks items requiring judgment as `SKIPPED`. Read the SKILL.md and evaluate only these:

- **S4** (progressive disclosure): Is content ordered from core rules → patterns → edge cases → references?
- **Q4** (grounded in docs): Are recommendations based on official documentation, not opinion?
- **Q6** (factual accuracy): Is content current and free of errors?

Score each as **PASS**, **WARN**, or **FAIL**. Merge your evaluations with the script's results to produce the final report.

---

## Phase A3: Report and Suggest Fixes

Present the audit report in this format:

```
Skill Audit: [skill-name]
═══════════════════════════

Score: [X]% ([rating])

Frontmatter Quality:
  F1 [name format]         — PASS
  F2 [TRIGGER clauses]     — PASS
  F3 [third-person voice]  — WARN: Mixed voice in description
  ...

Content Structure:
  S1 [announcement]        — PASS
  S2 [title + role]        — PASS
  S5 [line count]          — FAIL: 761 lines (target: < 500)
  ...

Content Quality:
  Q1 [degrees of freedom]  — PASS
  Q2 [code examples]       — WARN: Section 4 lacks examples
  ...

Tool Usage:
  T1 [tool match]          — PASS
  T2 [least privilege]     — PASS

Summary:
  PASS: [N]  WARN: [N]  FAIL: [N]  N/A: [N]

Recommended Actions (priority order):
  1. [FAIL] [What to fix and how]
  2. [FAIL] [What to fix and how]
  3. [WARN] [What to improve and why]
  ...
```

After presenting the report, ask:

```
Would you like me to apply these fixes?
  1. Apply all fixes
  2. Apply FAIL fixes only
  3. Review fixes one by one
  4. No changes — just keep the report
```

Use AskUserQuestion for the user's choice, then apply fixes as requested.

---

## Rules

1. **Accuracy over speed.** Never generate a skill with content you're uncertain about.
   Research first when confidence is below 9/10.
2. **Follow the template.** Use the skill template as a starting point for every generated
   skill. Adapt structure to the domain, but keep the core elements (announcement, role,
   sections, checklist).
3. **Self-audit is mandatory.** Always run the audit checklist on generated skills before
   presenting them. Fix FAILs; report WARNs.
4. **Respect the 500-line limit.** Extract supporting content into `references/` and
   `templates/` to keep SKILL.md focused and maintainable.
5. **Interview before assuming.** When the user's request is vague, ask clarifying questions.
   Don't fill gaps with plausible guesses.
6. **Transparent confidence.** Always show the confidence assessment. Users should see
   what you know and what you researched.
7. **No overlap.** Check for existing skills in the same domain before creating. Offer to
   extend or complement rather than duplicate.
8. **Dogfood the checklist.** The quality checklist in best-practices.md is the single
   source of truth for both create and audit modes.
