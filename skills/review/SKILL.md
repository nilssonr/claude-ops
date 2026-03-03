---
name: review
description: >-
  Orchestrates code reviews by running a discovery script to group files,
  then spawning parallel code-reviewer agents per domain. Consolidates
  findings into a unified report with deduplication and severity sorting.
  TRIGGER when: user asks to review code, review a PR, review staged changes,
  or says "code review", "review this", "what's wrong with this code".
  DO NOT TRIGGER when: user is writing code, refactoring, or debugging.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Agent
argument-hint: "[staged | file path | PR number]"
---

**Announce to the user: "Skill activated: review"**

# Review — Code Review Orchestrator

You orchestrate code reviews by running a discovery script, presenting a review plan, spawning code-reviewer agents, and consolidating their findings. You do NOT review code yourself.

Input: $ARGUMENTS

---

## Rules

1. MUST run the discovery script as the first action — no manual git exploration.
2. MUST present the review plan to the user before spawning agents.
3. MUST NOT call TaskOutput — agent results arrive automatically via notifications.
4. MUST deduplicate findings across agents in the final report.
5. MUST sort findings by severity in the final report.
6. MUST report partial failures — never silently drop a group.

---

## 1. Run Discovery

Run the discovery script to detect the review target, filter files, group by domain, and write per-group diffs to temp files. This is a single command — do not run additional git commands.

```bash
python3 [base_directory]/scripts/discover.py $ARGUMENTS
```

Where `[base_directory]` is the path from "Base directory for this skill:" in the header above.

The script outputs JSON:

```json
{
  "target": "HEAD~1 (last commit)",
  "total_files": 42,
  "deleted_files": 12,
  "groups": [
    {
      "name": "src/auth",
      "files": ["src/auth/login.ts", "src/auth/session.ts"],
      "file_count": 2,
      "diff_file": "/tmp/review-XXXXXX/group-1.diff"
    }
  ]
}
```

Key fields:

- `total_files`: reviewable files (added, modified, renamed-with-changes)
- `deleted_files`: pure deletions excluded from review (mentioned in the plan but not reviewed)
- `groups`: up to 8 review groups with pre-extracted diffs in temp files

If the result contains `"error": "no_changes"`:

> No changes found to review. Stage changes with `git add`, specify a file path, PR number, or `HEAD`.

Stop here.

If the result contains `"error": "command_failed"`:

> Discovery failed: [message from JSON]
>
> Check that the PR number is correct and you're in the right repository.

Stop here.

---

## 2. Present Review Plan

Show the user what will be reviewed before spawning any agents.

For single-group results (1-5 files):

```
Reviewing [N] files ([target]) — single reviewer.
```

For multi-group results (6+ files):

```
Review plan ([target]):

| # | Group | Files |
|---|-------|-------|
| 1 | [name] | [N] |
| 2 | [name] | [N] |

Total: [N] files across [N] reviewers
[If deleted_files > 0]: + [N] deleted files excluded from review
```

---

## 3. Spawn Code-Reviewer Agents

For each group, spawn a `claude-ops:code-reviewer` agent.

```
Agent tool parameters:
  subagent_type: "claude-ops:code-reviewer"
  run_in_background: true  (for multi-group reviews)
  prompt: <see below>
```

### Prompt template

For single-group reviews:

```
Review the following files. The diff is in [diff_file] — read it to begin.

Files:
- [file list]
```

For multi-group reviews:

```
You are reviewing group [N] of [M]: [group name].

The diff for your group is in [diff_file] — read it to begin.

Files in your group:
- [file list]

Focus your review on these files only.
```

Spawn all groups in parallel with `run_in_background: true`.

### Collecting results

After spawning all agents, output a short status message:

```
[N] reviewers running in parallel. Results will arrive as each completes.
```

**Do NOT call TaskOutput.** Agent results are delivered automatically as notifications. You will receive one notification per completed agent. Once all [N] agents have reported back, proceed to consolidation.

---

## 4. Consolidate Findings

After all agents have completed:

1. Collect all findings from all agents.
2. Deduplicate: if two agents flagged the same file:line, keep the higher-confidence finding.
3. Group findings by severity, then present per-group tables.
4. Produce the report in this format:

```
## Review Summary

**Target**: [what was reviewed]
**Files reviewed**: [total] | **Reviewers**: [N] | **Suppressed**: [N]

### Critical ([X])

| # | Finding | Location | Confidence | Group |
|---|---------|----------|------------|-------|
| 1 | [Short title] | `file:line` | [N]% | [group name] |

[For each CRIT finding, a detail block after the table:]

**1. [Finding title]**
[One-paragraph explanation with code snippet if relevant]

### Warnings ([Y])

| # | Finding | Location | Confidence | Group |
|---|---------|----------|------------|-------|
| 1 | ... | ... | ... | ... |

**1. [Finding title]**
[One-paragraph explanation]

### Info ([Z])

| # | Finding | Location | Confidence | Group |
|---|---------|----------|------------|-------|
| 1 | ... | ... | ... | ... |

Info findings do not need detail blocks unless non-obvious.

---

**Overall**: [One sentence assessment]
```

Omit any severity section with zero findings. For single-group reviews, omit the "Group" column.

---

## 5. Error Handling

| Error                  | Action                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| No changes to review   | Inform user: "No changes found to review."                         |
| Discovery script fails | Show the error output, suggest specifying a file path manually     |
| Reviewer agent fails   | Report which group failed, present findings from successful agents |
| All reviewers fail     | Report failure, suggest reviewing manually                         |
