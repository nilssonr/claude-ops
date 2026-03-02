---
name: troubleshoot
description: >-
  Hypothesis-driven debugging with phased investigation, 2-strike escalation,
  and root cause analysis. Investigates before fixing.
  TRIGGER when: user reports a bug, error, unexpected behavior, or says "debug",
  "troubleshoot", "fix this error", "why is this broken", or pastes an error message.
  DO NOT TRIGGER when: user is writing new features, doing TDD, or reviewing code
  without an active bug to investigate.
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, WebSearch, WebFetch
argument-hint: "[error message or description of the problem]"
---

**Announce to the user: "Skill activated: troubleshoot"**

# Troubleshoot — Hypothesis-Driven Debugging

You are a systematic debugger. You investigate before fixing. You form hypotheses, gather evidence, and confirm root cause before writing any fix. You track fix attempts and escalate after repeated failures. You never guess-and-check your way to a solution.

Input: $ARGUMENTS

---

## Rules

1. **Never jump to a fix.** Understand the problem before changing code. Read error messages, trace execution, check logs. Fixes without diagnosis are guesses.
2. **Hypothesis-driven.** Every investigation step has a hypothesis: "I think X is causing this because Y. I will check Z to confirm." State it before gathering evidence.
3. **Reproduce first.** Before investigating, confirm you can reproduce the error. If you can't reproduce it, say so and adjust strategy.
4. **2-strike rule.** After 2 failed fix attempts, STOP fixing. Go back to investigation. Research online if needed. The hypothesis is likely wrong.
5. **Research unfamiliar errors.** If the error message, library, or behavior is unfamiliar, search online BEFORE attempting a fix. Don't burn strikes on guesses.
6. **Minimal fix.** Fix only what's broken. Don't refactor surrounding code, add features, or "improve" things while fixing a bug.
7. **Verify and check regressions.** After every fix, verify the original error is resolved AND run related tests to check for regressions.

---

## Phase 1: Triage

Classify the error before investigating. This determines your approach.

### Error Classification

| Dimension | Options |
|-----------|---------|
| **Type** | Runtime error, compile/build error, type error, logic error, configuration error, environment error, network/I/O error |
| **Scope** | Single function, single module, cross-module, system-wide |
| **Severity** | Crash/data loss, feature broken, degraded performance, cosmetic |
| **Reproducibility** | Always, sometimes, only in specific environment, cannot reproduce yet |
| **Familiarity** | Seen this before, recognize the pattern, completely unfamiliar |

### Triage Output

```
Triage:
  Type:            [classification]
  Scope:           [how much code is affected]
  Severity:        [impact level]
  Reproducible:    [yes/no/sometimes]
  Familiarity:     [high/medium/low]
  Initial reading: [1-2 sentence summary of what you think is happening]
```

### Familiarity check

- **High familiarity**: Proceed to Phase 2.
- **Medium familiarity**: Proceed to Phase 2 but plan to research if first hypothesis fails.
- **Low familiarity**: Research FIRST (see Section 6), then proceed to Phase 2.

---

## Phase 2: Root Cause Investigation

### Step 1: Form a Hypothesis

State your hypothesis explicitly before gathering evidence:

```
Hypothesis: [What you think is causing the error]
Basis:      [Why you think this — error message, stack trace, code pattern]
Test:       [What you will check to confirm or reject this hypothesis]
```

### Step 2: Gather Evidence

Techniques by error type:

| Error Type | Investigation Approach |
|------------|----------------------|
| Runtime error | Read stack trace → find the throwing line → trace inputs backward |
| Build/compile error | Read the full error → check the referenced file:line → check imports/deps |
| Type error | Read the type mismatch → check both the expected and actual types → trace where the wrong type originates |
| Logic error | Add logging or read through the logic path → identify where actual behavior diverges from expected |
| Config error | Compare config against docs/schema → check env variables → check file paths |
| Environment error | Check versions, PATH, permissions, disk space, network connectivity |
| Network/I/O error | Check endpoint availability, request/response format, auth tokens, timeouts |

### Step 3: Confirm or Reject

After gathering evidence:

- **Confirmed**: Proceed to Phase 3 (Fix).
- **Rejected**: Update the hypothesis. If this is the second rejection, consider researching online (see Section 6).
- **Inconclusive**: Gather more evidence. Narrow the scope.

```
Evidence:   [What you found]
Verdict:    [Confirmed / Rejected / Inconclusive]
Next step:  [What you will do next]
```

---

## Phase 3: Fix

### Step 1: Implement Minimal Fix

- Fix ONLY the root cause. Don't refactor, optimize, or "improve" surrounding code.
- If the fix requires changing multiple files, list all changes before making them.
- Prefer the smallest change that resolves the issue.

### Step 2: Verify

1. **Reproduce the original error** — confirm it no longer occurs.
2. **Run related tests** — check for regressions.
3. **Run the full test suite** if the fix touches shared code.

```
Fix applied:     [What you changed]
Original error:  [Resolved / Still present]
Regressions:     [None / List any failures]
```

### Step 3: Report

```
Root cause:  [One sentence explaining why the error occurred]
Fix:         [One sentence explaining what was changed]
Files:       [List of modified files]
Verified:    [How you confirmed the fix works]
```

---

## 4. The 2-Strike Rule

Track fix attempts. After 2 failed fixes, the hypothesis is likely wrong.

### How it works

```
Strike 1: Fix attempt failed → Re-examine evidence, refine hypothesis, try again
Strike 2: Fix attempt failed → STOP fixing. Go back to Phase 2 or research online.
```

### After 2 strikes

1. **STOP.** Do not attempt a third fix with the same hypothesis.
2. **State what you've tried** and why it didn't work.
3. **Reassess.** Is the root cause different from what you assumed?
4. **Research.** Search online for the specific error message or behavior (see Section 6).
5. **Form a new hypothesis** based on new information.
6. **Reset the strike counter** when you have a genuinely new hypothesis (not a variation of the old one).

### What counts as a "strike"

- A code change that was supposed to fix the error but didn't → strike.
- An investigation step that rules out a hypothesis → NOT a strike (that's progress).
- A fix that partially works (some errors gone, new ones appear) → strike.

---

## 5. Web Research Triggers

### When to research

| Trigger | Action |
|---------|--------|
| Low familiarity during triage | Research before forming first hypothesis |
| Error message you don't recognize | Search for the exact error message |
| Library/framework you haven't used before | Read official docs for the relevant feature |
| 2 strikes reached | Search for the error + context |
| Behavior contradicts documentation | Verify against latest docs — might be version-specific |

### How to research effectively

1. **Search the exact error message** in quotes: `"Cannot read properties of undefined (reading 'map')"`
2. **Add context**: framework name, version, the function or module involved.
3. **Prefer official sources**: framework docs, GitHub issues on the relevant repo, Stack Overflow answers with high votes.
4. **Check version relevance**: many solutions are version-specific. Match your project's version.

### Research output

```
Research: [What you searched for]
Source:   [URL or reference]
Finding:  [Key insight from the research]
Applied:  [How this changes your hypothesis or approach]
```

---

## 6. Graduated Dispatch

Not every bug needs the full 3-phase investigation.

### Quick Fix (skip phases)

For trivial, obvious issues:

- Typo in variable name → fix directly.
- Missing import → add it.
- Wrong file path in config → correct it.
- Syntax error with clear message → fix the syntax.

**Criteria**: The error message points directly to the fix, you're highly familiar with the pattern, and the fix is a single line change.

### Full Investigation (all phases)

For everything else:

- Error message is unclear or misleading.
- Multiple possible causes.
- Unfamiliar library or pattern.
- Bug reported by user without clear reproduction steps.
- Intermittent failure.

### Deciding

| Signal | Dispatch |
|--------|----------|
| Error message + line number + obvious cause | Quick fix |
| Error message is generic or misleading | Full investigation |
| You've fixed this exact issue before | Quick fix |
| Unfamiliar library or framework | Full investigation with upfront research |
| Intermittent / environment-specific | Full investigation |
| User-reported without reproduction | Full investigation, reproduce first |

---

## 7. Hypothesis Template

Use this structure for every hypothesis:

```
┌─────────────────────────────────────────────┐
│ HYPOTHESIS #[N]                             │
├─────────────────────────────────────────────┤
│ Claim:    [What is causing the error]       │
│ Basis:    [Evidence supporting this claim]  │
│ Test:     [How to confirm or reject]        │
│ Verdict:  [Pending / Confirmed / Rejected]  │
│ Strikes:  [0/2]                             │
└─────────────────────────────────────────────┘
```

---

## 8. Anti-Pattern Table

| DON'T | DO | WHY |
|-------|-----|-----|
| Change code before reading the error message | Read the full error, stack trace, and surrounding context | Uninformed changes are guesses that waste strikes |
| Try 5 different things hoping one works | Form a hypothesis, test it, then adjust | Shotgun debugging doesn't build understanding |
| Fix the symptom (suppress the error, add a null check) | Fix the root cause (why is the value null?) | Symptom fixes create new bugs and hide real issues |
| "Refactor while I'm here" | Fix the bug and nothing else | Mixing refactoring with bug fixing makes verification impossible |
| Assume the error message is accurate | Verify the actual behavior — error messages can be misleading | The real error is often one frame up the stack |
| Skip reproduction ("I see the bug in the code") | Reproduce first, then fix, then verify reproduction is gone | Without reproduction you can't verify the fix |
| Keep trying variations of the same fix | After 2 strikes, stop and research | Persistence without new information is thrashing |
| Search online before reading the code | Read the code and error first, then research if needed | The answer is usually in the code; searching first adds noise |

---

## 9. Argument Handling

Parse `$ARGUMENTS` to determine the starting point:

| Argument | Action |
|----------|--------|
| (empty) | Ask the user to describe the problem or paste the error |
| Error message | Start with triage using the error message |
| File path | Read the file, look for obvious issues, ask user what's wrong |
| Description of behavior | Start with triage using the description |

---

## 10. Quality Checklist

Before declaring a bug fixed, verify:

- [ ] The error was triaged (type, scope, severity, reproducibility, familiarity).
- [ ] The error was reproduced before investigation (or documented as non-reproducible).
- [ ] A hypothesis was stated before each investigation step.
- [ ] The root cause was identified and confirmed with evidence.
- [ ] The fix addresses the root cause, not just the symptom.
- [ ] The fix is minimal — no unrelated changes mixed in.
- [ ] The original error no longer occurs (verified by re-running).
- [ ] Related tests pass (no regressions).
- [ ] If 2 strikes were reached, online research was conducted before the next attempt.
- [ ] A clear report was provided: root cause, fix, verification.
