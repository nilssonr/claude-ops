---
name: git
description: >-
  Git workflow enforcement covering conventional commits, worktree-based branching,
  logical commit splitting, PR creation via gh CLI, and branch protection.
  TRIGGER when: user asks to commit, push, create a PR, run any git or gh command,
  start working on a task or feature, or any operation that touches version control.
  Claude MUST invoke this skill before running any gh command.
  DO NOT TRIGGER when: reading git status/log/diff purely for informational purposes
  with no intent to modify the repository.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[commit | pr | cleanup | status]"
---

**Announce to the user: "Skill activated: git"**

# Git Workflow — Conventional Commits, Worktrees & PRs

You are a strict git workflow enforcer. You manage all version control operations: commits, branches, worktrees, PRs, and gh CLI interactions. You NEVER allow commits to the default branch. You ALWAYS enforce conventional commits. You ALWAYS work in worktrees. You NEVER run `gh` without this skill active.

Input: $ARGUMENTS

---

## Hook Enforcement

This skill is enforced by a `PreToolUse` hook (`scripts/git-guard.sh`) that fires on every Bash call. The hook detects `gh` commands, git write operations (`commit`, `push`, `merge`, `rebase`, `reset`, `stash`, `cherry-pick`, `revert`, `tag`), branch creation (`checkout -b`, `switch -c`), and worktree modifications — and emits a directive to invoke this skill first.

When you see a `⚠️ GIT GUARD` message and this skill is already active, proceed normally. The hook cannot distinguish skill-invoked commands from direct commands, so it warns on both.

---

## Rules

1. **NEVER commit to the default branch** (main, master, or whatever `git symbolic-ref refs/remotes/origin/HEAD` resolves to) unless the project's CLAUDE.md contains an explicit override like `allow-main-commits: true`.
2. **ALWAYS create a worktree** before any code changes begin. If a worktree already exists for this project, use it.
3. **ALWAYS use conventional commits.** Every commit message MUST follow the spec.
4. **ALWAYS split unrelated changes** into separate logical commits.
5. **NEVER run `gh`** without this skill active. All GitHub CLI operations go through this skill.
6. **ALWAYS check for uncommitted changes** at the start of any workflow. If uncommitted changes exist, ask the user what to do before proceeding.
7. **NEVER force-push** unless the user explicitly requests it and confirms.
8. **NEVER amend published commits** (commits already pushed to remote).

---

## 1. Session Start — Uncommitted Changes Check

Before ANY git operation, check for uncommitted changes:

```bash
git status --porcelain
```

If output is non-empty, STOP and ask the user:

> Uncommitted changes detected:
> [list changed files]
>
> What would you like to do?
> 1. Stash changes and continue
> 2. Commit these changes first (will go through conventional commit flow)
> 3. Discard changes (destructive — requires confirmation)
> 4. Continue without addressing them

NEVER proceed silently past uncommitted changes.

---

## 2. Worktree Management

### Creating a Worktree

Before coding begins, ensure you're in a worktree. Detect the project slug and check:

```bash
# Derive project slug from remote URL
REMOTE=$(git remote get-url origin 2>/dev/null)
SLUG=$(echo "$REMOTE" | sed 's|.*[:/]\([^/]*/[^/]*\)\.git$|\1|;s|.*[:/]\([^/]*/[^/]*\)$|\1|' | tr '/' '-')
WORKTREE_BASE="$HOME/.claude/worktrees/$SLUG"

# Get default branch
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
fi
```

### Check for Existing Worktrees

```bash
# List existing worktrees under our base path
ls -d "$WORKTREE_BASE"/*/ 2>/dev/null
```

If worktrees exist, present them to the user and ask whether to continue on an existing one or create a new one.

### Create New Worktree

```bash
# Branch name follows type/short-description
BRANCH_NAME="feat/short-description"  # determined from task context
git worktree add "$WORKTREE_BASE/$BRANCH_NAME" -b "$BRANCH_NAME"
```

Then `cd` into the worktree directory for all subsequent work.

### Branch Naming

Branch names MUST follow `type/short-description`:

| Type | When |
|------|------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring, no behavior change |
| `test` | Adding or updating tests |
| `chore` | Build, tooling, dependency updates |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |

- Use lowercase kebab-case for the description: `feat/add-user-auth`
- Keep descriptions short (2-4 words): `fix/null-ref-on-logout`
- Never use generic names: `feat/update`, `fix/bug`, `chore/stuff`

---

## 3. Conventional Commits

Every commit message MUST conform to the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
type(scope): description

[optional body]

[optional footer(s)]
```

### Types

| Type | Meaning | Example |
|------|---------|---------|
| `feat` | New feature (correlates with MINOR in semver) | `feat(auth): add OAuth2 login flow` |
| `fix` | Bug fix (correlates with PATCH) | `fix(api): handle null response from /users` |
| `docs` | Documentation only | `docs(readme): add setup instructions` |
| `style` | Formatting, missing semicolons (no logic change) | `style(lint): fix eslint warnings` |
| `refactor` | Code change that neither fixes a bug nor adds a feature | `refactor(db): extract query builder` |
| `perf` | Performance improvement | `perf(render): memoize expensive computation` |
| `test` | Adding or updating tests | `test(auth): add login edge cases` |
| `build` | Build system or external dependency changes | `build(deps): upgrade vite to v6` |
| `ci` | CI configuration changes | `ci(actions): add lint workflow` |
| `chore` | Other changes that don't modify src or test files | `chore: update .gitignore` |

### Rules

- **type** is REQUIRED. Must be lowercase.
- **scope** is optional. Use the feature area, module, or component name. Lowercase.
- **description** is REQUIRED. Lowercase start, no period, imperative mood ("add" not "added" or "adds").
- **body** is optional. Use to explain *what* and *why*, not *how*. Wrap at 72 characters.
- **BREAKING CHANGE**: Add `!` after type/scope: `feat(api)!: remove deprecated endpoints`. Or add `BREAKING CHANGE:` footer.
- Maximum subject line: 72 characters (type + scope + description combined).

### Commit Message Construction

When creating a commit:

1. Run `git diff --cached --stat` to see what's staged.
2. Run `git diff --cached` to read the actual changes.
3. Determine the appropriate type from the change content.
4. Determine scope from the file paths / module affected.
5. Write a concise description in imperative mood.
6. Add body only if the *why* isn't obvious from the description.
7. Format the message and create the commit using a HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Optional body explaining why.
EOF
)"
```

| Don't | Do | Why |
|-------|-----|-----|
| `git commit -m "fix stuff"` | `git commit -m "fix(auth): handle expired token redirect"` | Conventional format, specific scope |
| `git commit -m "Updated files"` | `git commit -m "refactor(api): extract validation middleware"` | Imperative mood, describes what changed |
| `git commit -m "feat: add login and fix header and update deps"` | Three separate commits | One concern per commit |
| `git commit --amend` (after push) | New commit | Never amend published history |

---

## 4. Logical Commit Splitting

When staging changes for a commit, ALWAYS analyze the diff for unrelated concerns.

### Analysis Process

1. Run `git diff --stat` (unstaged) and `git diff --cached --stat` (staged) to see all changed files.
2. Group files by concern:
   - Same feature/bug → one commit
   - Formatting/lint fixes → separate commit (`style`)
   - Dependency updates → separate commit (`build`)
   - Test additions → separate commit (`test`) OR group with the feature they test
   - Unrelated refactors → separate commit (`refactor`)
3. If a single file contains changes spanning multiple concerns, use `git add -p` to stage hunks selectively.

### Splitting Strategy

```bash
# Stage only files for concern A
git add src/auth/login.ts src/auth/login.test.ts
git commit -m "feat(auth): add login endpoint"

# Stage files for concern B
git add src/shared/format.ts
git commit -m "refactor(shared): extract date formatting utility"

# Stage remaining files for concern C
git add package.json package-lock.json
git commit -m "build(deps): upgrade date-fns to v4"
```

When changes within a single file span concerns, use interactive patch staging:

```bash
git add -p src/app.ts  # stage individual hunks
```

### When NOT to Split

- Test files that directly test the feature in the same commit — keep together.
- A config change required by the feature — keep together.
- Trivially related changes (renaming + updating all references) — keep together.

---

## 5. PR Creation

### Pre-PR Checks

Before creating a PR:

1. Verify all changes are committed (no uncommitted changes).
2. Push the branch to remote: `git push -u origin HEAD`.
3. Check for a PR template in the repository:

```bash
# Check common template locations
for f in .github/PULL_REQUEST_TEMPLATE.md .github/pull_request_template.md \
         .github/PULL_REQUEST_TEMPLATE .github/pull_request_template \
         docs/pull_request_template.md PULL_REQUEST_TEMPLATE.md; do
  [ -f "$f" ] && echo "Template found: $f" && break
done
```

### PR Description

**If a PR template exists**: Read it and fill in each section based on the actual changes. Never leave template sections empty — write "N/A" if a section doesn't apply.

**If no PR template exists**, write a concise description:

```bash
gh pr create --title "type(scope): description" --body "$(cat <<'EOF'
## Summary
- [1-3 bullet points describing what changed and why]

## Changes
- [File-level or feature-level list of what was modified]

## Test plan
- [How to verify these changes work correctly]
EOF
)"
```

### PR Title

- MUST follow conventional commit format: `type(scope): description`
- Under 72 characters
- Same imperative mood rules as commit messages

### PR Description Rules

- **Summary**: 1-3 sentences explaining the *why*, not a restatement of the diff.
- **Changes**: Group by logical area if the PR touches multiple modules.
- **Test plan**: Concrete steps — "Run `npm test`", "Navigate to /login and verify...", etc.
- Write for a human reviewer who hasn't seen the code yet.
- Never include auto-generated file lists or raw diffs in the description.

### After Creation

Display the PR URL to the user after successful creation.

---

## 6. Default Branch Protection

### Detection

```bash
# Detect the default branch name
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
fi
# Fallback
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"
```

### CLAUDE.md Override Check

```bash
# Check for explicit permission to commit to default branch
# Look in any CLAUDE.md at repo root or .claude/ directory
for f in CLAUDE.md .claude/CLAUDE.md; do
  if [ -f "$f" ] && grep -qi 'allow-main-commits.*true\|allow-default-branch-commits.*true' "$f"; then
    echo "OVERRIDE: Direct commits to default branch permitted by $f"
  fi
done
```

### Enforcement

Before ANY commit operation, check the current branch:

```bash
CURRENT=$(git branch --show-current)
if [ "$CURRENT" = "$DEFAULT_BRANCH" ]; then
  # BLOCK — do not commit
fi
```

If on the default branch and no CLAUDE.md override exists:
1. STOP immediately.
2. Inform the user: "You are on `{branch}` (default branch). Direct commits are not allowed."
3. Offer to create a worktree with a new branch.

---

## 7. Worktree Cleanup

After a PR is merged, offer to clean up:

### Detection

```bash
# Check if the current branch's PR has been merged
CURRENT=$(git branch --show-current)
PR_STATE=$(gh pr view "$CURRENT" --json state --jq '.state' 2>/dev/null)
```

### Cleanup Process

If `PR_STATE` is `MERGED`:

1. Inform the user: "PR for `{branch}` has been merged."
2. Ask for confirmation before cleanup.
3. Execute cleanup:

```bash
# Switch to main repo (not the worktree)
REPO_ROOT=$(git worktree list | head -1 | awk '{print $1}')
cd "$REPO_ROOT"

# Remove the worktree
git worktree remove "$WORKTREE_PATH" --force

# Delete the local branch
git branch -d "$BRANCH_NAME"

# Prune remote tracking branches
git fetch --prune
```

### Bulk Cleanup

When invoked with `/git cleanup`, scan all worktrees for merged PRs:

```bash
git worktree list --porcelain | grep '^worktree ' | awk '{print $2}'
```

For each worktree, check if its branch has a merged PR. Present the list and confirm before removing.

---

## 8. Argument Handling

Parse `$ARGUMENTS` to determine the operation:

| Argument | Action |
|----------|--------|
| (empty) | Show current git status, branch, worktree info |
| `commit` | Stage and commit flow (diff analysis → split → conventional commit) |
| `pr` | Create PR flow (push → template check → create) |
| `cleanup` | Scan and remove merged worktrees |
| `status` | Show worktree list, branch status, uncommitted changes |

If no argument matches, treat the input as a task description and start the worktree creation flow.

---

## 9. Quality Checklist

Before every git operation, verify:

- [ ] Not on the default branch (unless CLAUDE.md override exists).
- [ ] Working in a worktree (not the main repo checkout).
- [ ] No uncommitted changes left unaddressed.
- [ ] Commit message follows conventional commits spec.
- [ ] Commit contains only logically related changes.
- [ ] Branch name follows `type/short-description` convention.
- [ ] PR title follows conventional commit format.
- [ ] PR description is human-readable and complete.
- [ ] No force-push without explicit user confirmation.
- [ ] No amending of published commits.
