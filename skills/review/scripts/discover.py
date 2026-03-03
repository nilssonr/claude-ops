#!/usr/bin/env python3
"""
Review discovery: detects target, filters files, groups by domain, writes per-group diffs.

Outputs JSON to stdout. Called by the review skill orchestrator.

Usage:
    python3 discover.py                     # staged changes, fallback to HEAD~1
    python3 discover.py staged              # staged changes only
    python3 discover.py HEAD                # last commit
    python3 discover.py 42                  # PR #42
    python3 discover.py main...HEAD         # branch comparison
    python3 discover.py src/foo.ts src/bar  # specific files
"""

import json
import os
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

MAX_GROUPS = 8


def git(*args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def detect_target(raw_arg):
    """
    Returns (description, diff_base_cmd, is_git_diff).
    - diff_base_cmd: list of command parts for generating diffs
    - is_git_diff: True if we can append --name-status / -- files
    """
    arg = raw_arg.strip()

    if not arg or arg == "staged":
        if git("diff", "--cached", "--name-only"):
            return "staged changes", ["git", "diff", "--cached"], True
        return "HEAD~1 (last commit)", ["git", "diff", "HEAD~1"], True

    if arg in ("HEAD", "latest"):
        return "HEAD~1 (last commit)", ["git", "diff", "HEAD~1"], True

    # PR number or URL — normalize "PR #67", "PR 67", "#67" → "67"
    pr_num = None
    pr_match = re.match(r'^(?:PR\s*)?#?(\d+)$', arg, re.IGNORECASE)
    if pr_match:
        pr_num = pr_match.group(1)
    elif "github.com" in arg and "/pull/" in arg:
        pr_num = arg.rstrip("/").split("/")[-1]
    if pr_num:
        return f"PR #{pr_num}", ["gh", "pr", "diff", pr_num], False

    # Branch ref (contains .. or ...)
    if "..." in arg or ".." in arg:
        return arg, ["git", "diff", arg], True

    # File path(s) — check if any exist on disk
    paths = arg.split()
    existing = [p for p in paths if Path(p).exists()]
    if existing:
        return f"files: {', '.join(existing)}", None, False

    # Last resort: try as a git ref
    return arg, ["git", "diff", arg], True


def get_files_git(cmd_parts):
    """Get changed files via git diff --name-status. Returns (reviewable, deleted_count)."""
    r = subprocess.run(cmd_parts + ["--name-status"], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        return [], 0

    files = []
    deleted = 0
    for line in r.stdout.strip().split("\n"):
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status = parts[0]
        if status == "R100":
            continue
        filename = parts[2] if status.startswith("R") and len(parts) > 2 else parts[1]
        if _skip_file(filename):
            continue
        if status == "D":
            deleted += 1
            continue
        files.append(filename)
    return files, deleted


def get_files_from_diff(diff_text):
    """Parse file names from raw unified diff output."""
    files = []
    for line in diff_text.split("\n"):
        if line.startswith("diff --git"):
            parts = line.split(" b/", 1)
            if len(parts) == 2:
                f = parts[1]
                if not _skip_file(f):
                    files.append(f)
    return files


def _skip_file(filename):
    """True if the file should be excluded from review."""
    skips = [
        "pnpm-lock.yaml", "package-lock.json", "yarn.lock",
        "/generated/", "generated/",
    ]
    return any(p in filename for p in skips)


def group_files(files):
    """
    Group files by directory. Rules:
    - Root files -> "root config"
    - src/X/... -> "src/X"
    - test dirs -> merge with matching src group
    - Groups >10 files -> split by next directory level
    - Groups with 1 file -> merge into nearest group
    - Cap at MAX_GROUPS by merging smallest groups
    """
    groups = defaultdict(list)
    for f in files:
        parts = f.split("/")
        if len(parts) == 1:
            groups["root config"].append(f)
        elif parts[0] == "src" and len(parts) >= 2:
            groups[f"src/{parts[1]}"].append(f)
        elif parts[0] in ("test", "tests", "__tests__", "spec"):
            src_key = f"src/{parts[1]}" if len(parts) >= 2 else "tests"
            groups[src_key].append(f)
        else:
            groups[parts[0]].append(f)

    # Split large groups by next level
    refined = {}
    for key, flist in groups.items():
        if len(flist) > 10 and "/" in key:
            subgroups = defaultdict(list)
            for f in flist:
                parts = f.split("/")
                subkey = "/".join(parts[:3]) if len(parts) >= 3 else key
                subgroups[subkey].append(f)
            if len(subgroups) > 1:
                refined.update(subgroups)
            else:
                refined[key] = flist
        else:
            refined[key] = flist

    # Merge single-file groups into nearest neighbor
    final = {}
    singles = {}
    for key, flist in refined.items():
        if len(flist) <= 1:
            singles[key] = flist
        else:
            final[key] = flist

    if singles:
        if final:
            target = "root config" if "root config" in final else max(final, key=lambda k: len(final[k]))
            for flist in singles.values():
                final[target].extend(flist)
        else:
            final["all files"] = [f for flist in singles.values() for f in flist]

    # Cap at MAX_GROUPS by merging smallest groups
    while len(final) > MAX_GROUPS:
        smallest_key = min(final, key=lambda k: len(final[k]))
        smallest_files = final.pop(smallest_key)
        # Merge into the most related group (longest common prefix) or the largest
        best_target = max(final, key=lambda k: (
            len(os.path.commonprefix([smallest_key, k])),
            -len(final[k]),
        ))
        final[best_target].extend(smallest_files)

    return final


def filter_diff_for_files(raw_diff, target_files):
    """Extract sections of a unified diff matching target files."""
    target_set = set(target_files)
    result = []
    current_file = None
    current_lines = []

    for line in raw_diff.split("\n"):
        if line.startswith("diff --git"):
            if current_file in target_set:
                result.extend(current_lines)
            current_lines = [line]
            parts = line.split(" b/", 1)
            current_file = parts[1] if len(parts) == 2 else None
        else:
            current_lines.append(line)

    if current_file in target_set:
        result.extend(current_lines)
    return "\n".join(result)


def main():
    raw_arg = " ".join(sys.argv[1:])
    desc, cmd_parts, is_git = detect_target(raw_arg)

    # Direct file review (no diff)
    if cmd_parts is None:
        file_paths = raw_arg.split()
        existing = [p for p in file_paths if Path(p).exists()]
        if not existing:
            print(json.dumps({"error": "no_changes"}))
            return
        tmpdir = tempfile.mkdtemp(prefix="review-")
        diff_file = os.path.join(tmpdir, "group-1.diff")
        parts = []
        for p in existing:
            parts.append(f"=== {p} ===\n")
            with open(p) as f:
                parts.append(f.read())
            parts.append("\n")
        with open(diff_file, "w") as f:
            f.write("".join(parts))
        print(json.dumps({
            "target": desc,
            "total_files": len(existing),
            "deleted_files": 0,
            "groups": [{"name": "all files", "files": existing,
                        "file_count": len(existing), "diff_file": diff_file}],
        }))
        return

    # Get file list
    raw_diff = None
    deleted_count = 0
    if is_git:
        files, deleted_count = get_files_git(cmd_parts)
    else:
        r = subprocess.run(cmd_parts, capture_output=True, text=True)
        if r.returncode != 0 or not r.stdout.strip():
            if r.returncode != 0 and r.stderr.strip():
                print(json.dumps({"error": "command_failed", "message": r.stderr.strip()}))
            else:
                print(json.dumps({"error": "no_changes"}))
            return
        raw_diff = r.stdout
        files = get_files_from_diff(raw_diff)

    if not files:
        if deleted_count > 0:
            print(json.dumps({
                "target": desc, "total_files": 0, "deleted_files": deleted_count,
                "groups": [],
                "note": f"{deleted_count} files were deleted (excluded from review).",
            }))
        else:
            print(json.dumps({"error": "no_changes"}))
        return

    tmpdir = tempfile.mkdtemp(prefix="review-")

    # Single group (<=5 files)
    if len(files) <= 5:
        diff_file = os.path.join(tmpdir, "group-1.diff")
        if is_git:
            r = subprocess.run(cmd_parts + ["--"] + files, capture_output=True, text=True)
            diff_content = r.stdout
        else:
            diff_content = raw_diff
        with open(diff_file, "w") as f:
            f.write(diff_content)
        print(json.dumps({
            "target": desc,
            "total_files": len(files),
            "deleted_files": deleted_count,
            "groups": [{"name": "all files", "files": files,
                        "file_count": len(files), "diff_file": diff_file}],
        }))
        return

    # Multi-group (>5 files)
    grouped = group_files(files)
    groups = []
    for i, (name, flist) in enumerate(sorted(grouped.items()), 1):
        diff_file = os.path.join(tmpdir, f"group-{i}.diff")
        if is_git:
            r = subprocess.run(cmd_parts + ["--"] + flist, capture_output=True, text=True)
            diff_content = r.stdout
        else:
            diff_content = filter_diff_for_files(raw_diff, flist)
        with open(diff_file, "w") as f:
            f.write(diff_content)
        groups.append({
            "name": name, "files": flist,
            "file_count": len(flist), "diff_file": diff_file,
        })

    print(json.dumps({
        "target": desc,
        "total_files": len(files),
        "deleted_files": deleted_count,
        "groups": groups,
    }))


if __name__ == "__main__":
    main()
