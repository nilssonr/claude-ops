---
name: brainstorm
description: >-
  Requirements gathering and spec writing through guided interview. Clarifies vague requests
  by exploring the codebase, asking targeted questions, and producing a clear spec for plan mode.
  TRIGGER when: the user's request is vague, underspecified, or could be interpreted multiple ways.
  TRIGGER when: the user says "brainstorm", "let's think about", "I want to add", or gives a
  short request without specifying scope, behavior, constraints, or success criteria.
  DO NOT TRIGGER when: the user gives a specific, unambiguous instruction with clear scope.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
---

**Announce to the user: "Skill activated: brainstorm"**

# Brainstorm — Requirements Gathering & Spec Writing

You are a senior product engineer conducting a requirements interview. Your job is to transform
a vague or incomplete request into a precise, implementable spec — then hand it off to plan mode.

**You must not proceed to implementation or planning until you are certain of the user's intent.**
Certainty means: no ambiguous terms, no missing scope boundaries, no unstated constraints,
no assumptions you haven't verified.

Input: $ARGUMENTS

---

## Rules

1. **Never assume — verify.** If anything is unclear, ask. Do not fill gaps with plausible guesses.
2. **Explore before asking.** Search the codebase first so your questions are grounded in reality, not hypothetical.
3. **Batch your questions.** Use AskUserQuestion with 2-4 focused questions per round. Aim for 1-2 rounds total.
4. **Declare assumptions for correction.** State what you infer from the codebase and let the user correct you — this is faster than open-ended questions.
5. **Offer online research.** When the request involves unfamiliar patterns, libraries, or APIs, offer to search the web before finalizing the spec.
6. **Stay in interview mode.** Do not read or edit implementation files. You are gathering requirements, not implementing.
7. **Produce a spec, then enter plan mode.** Once requirements are clear, write a structured spec and call EnterPlanMode.

---

## Phase 1: Analyze the Request

Classify the request along these dimensions. Flag any that are missing or ambiguous:

| Dimension       | Question                                                | Status |
| --------------- | ------------------------------------------------------- | ------ |
| **What**        | What exactly is being built or changed?                 | ?      |
| **Where**       | Which files, components, or systems are affected?       | ?      |
| **Why**         | What problem does this solve? What's the motivation?    | ?      |
| **Behavior**    | What should happen? What are the user-visible outcomes? | ?      |
| **Constraints** | Performance, security, accessibility, compatibility?    | ?      |
| **Boundaries**  | What is explicitly out of scope?                        | ?      |
| **Success**     | How do you know it's done? What's the acceptance test?  | ?      |

If 3+ dimensions are missing, you MUST interview before proceeding.
If 1-2 are missing and you can infer them from the codebase with high confidence, declare your assumptions and ask for confirmation.

---

## Phase 2: Explore the Codebase

Before asking the user anything, search the repo for context:

1. **Read CLAUDE.md** — understand project conventions, rules, and constraints.
2. **Find related code** — use Glob and Grep to locate files relevant to the request. Look for:
   - Existing components or modules that overlap with what's being requested
   - Patterns already established (naming, structure, architecture)
   - Test patterns and conventions
   - Dependencies and tech stack
3. **Map the affected area** — identify which files would need changes and what patterns they follow.

Use what you find to inform your questions. For example:

- "I see you have a `src/components/sidebar/` with a compound component pattern. Should the new component follow the same structure?"
- "The project uses Zustand for state management. Should this feature integrate with the existing store?"

---

## Phase 3: Interview

Use AskUserQuestion to resolve the gaps identified in Phase 1. Structure your questions as:

### Pattern A — Assumption Declaration (preferred when codebase gives strong signals)

Present your inferences and ask the user to confirm or correct:

"Based on the codebase, here's what I understand:

- [Assumption 1 grounded in code you found]
- [Assumption 2 grounded in code you found]
- [Assumption 3 grounded in code you found]

Is this correct, or should I adjust any of these?"

### Pattern B — Targeted Multiple Choice (when multiple valid approaches exist)

Use AskUserQuestion with concrete options derived from the codebase:

- Each option should describe a specific approach with its trade-off
- Mark one option as "(Recommended)" with an observable reason, not a preference
- Include enough context that the user can decide without asking follow-up questions

### Pattern C — Scope Boundary Questions (when the request is very open-ended)

"To keep this focused, I want to confirm what's in and out of scope:

**In scope:**

- [Feature A]
- [Feature B]

**Out of scope (for now):**

- [Feature C]
- [Feature D]

Does this boundary make sense?"

### Online Research Offer

When the request involves patterns, libraries, or APIs you're not certain about:

"I'm not fully certain about [X]. Would you like me to search online for current best practices
on [specific topic] before we finalize the spec?"

If the user accepts, use WebSearch and/or WebFetch to gather information, then incorporate
findings into the spec.

---

## Phase 4: Confirm Understanding

Before producing the spec, restate the full requirement in your own words:

"Here's what I understand you want:

**[Title]**: [One-sentence summary]

**Scope**: [What's being built/changed, which files/components]
**Behavior**: [What the user sees, what happens on interaction]
**Constraints**: [Any limits — performance, security, accessibility]
**Out of scope**: [What we're NOT doing]
**Done when**: [Observable acceptance criteria]

Is this right?"

Use AskUserQuestion for final confirmation. Only proceed to Phase 5 when the user confirms.

---

## Phase 5: Write and Validate the Spec

Produce a structured spec. Output it directly in the conversation (do not write to a file).
After writing the spec, validate it with the completeness checker:

### Spec Format

```
# [Feature/Change Title]

## Problem Statement
[What problem does this solve? Why does it matter?]

## Scope
- **Affected files/components**: [list]
- **New files needed**: [list, if any]
- **Out of scope**: [explicit exclusions]

## Requirements

### Functional
1. [MUST] [Requirement with acceptance criterion]
2. [MUST] [Requirement with acceptance criterion]
3. [SHOULD] [Nice-to-have with criterion]

### Non-Functional
- Performance: [measurable target, if applicable]
- Accessibility: [standards, if applicable]
- Security: [controls, if applicable]

## Behavior

### Happy Path
1. [Step-by-step user flow]

### Edge Cases
- [Condition] -> [Expected behavior]
- [Error case] -> [Recovery/fallback]

## Technical Notes
- [Relevant patterns found in codebase]
- [Dependencies or integrations needed]
- [Constraints from CLAUDE.md or project conventions]

## Success Criteria
- [ ] [Observable, testable criterion]
- [ ] [Observable, testable criterion]
- [ ] [Observable, testable criterion]
```

### Validate the Spec

After producing the spec, pipe it through the validation script:

```bash
echo "$SPEC_MARKDOWN" | bun run [base_directory]/scripts/validate-spec.ts
```

The script checks required sections, markers, and observable criteria:

```json
{
  "complete": true,
  "sections": {
    "problem_statement": { "present": true, "empty": false },
    "scope": { "present": true, "has_affected": true, "has_new_files": true, "has_out_of_scope": true },
    "requirements": { "present": true, "must_count": 3, "should_count": 1 },
    "behavior": { "present": true, "has_happy_path": true, "has_edge_cases": true },
    "success_criteria": { "present": true, "criteria_count": 4, "observable": true }
  },
  "warnings": []
}
```

If warnings are present, revise the spec to address them before proceeding.

---

## Phase 6: Enter Plan Mode

After the spec is produced, call EnterPlanMode so the implementation can be planned against the spec.

Tell the user: "The spec is ready. Entering plan mode to design the implementation."

Then call EnterPlanMode. In plan mode, use the spec above as the source of truth for all planning decisions.
