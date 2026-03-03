import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Review discovery: detects target, filters files, groups by domain, writes per-group diffs.
 *
 * Outputs JSON to stdout. Called by the review skill orchestrator.
 *
 * Usage:
 *     bun run discover.ts                     # staged changes, fallback to HEAD~1
 *     bun run discover.ts staged              # staged changes only
 *     bun run discover.ts HEAD                # last commit
 *     bun run discover.ts 42                  # PR #42
 *     bun run discover.ts main...HEAD         # branch comparison
 *     bun run discover.ts src/foo.ts src/bar  # specific files
 */

const MAX_GROUPS = 8;

function git(...args: string[]): string {
  const r = spawnSync("git", args, { encoding: "utf-8" });
  return r.status === 0 ? (r.stdout?.trim() ?? "") : "";
}

type Target = {
  description: string;
  cmdParts: string[] | null;
  isGitDiff: boolean;
};

function detectTarget(rawArg: string): Target {
  const arg = rawArg.trim();

  if (!arg || arg === "staged") {
    if (git("diff", "--cached", "--name-only")) {
      return {
        description: "staged changes",
        cmdParts: ["git", "diff", "--cached"],
        isGitDiff: true,
      };
    }
    return {
      description: "HEAD~1 (last commit)",
      cmdParts: ["git", "diff", "HEAD~1"],
      isGitDiff: true,
    };
  }

  if (arg === "HEAD" || arg === "latest") {
    return {
      description: "HEAD~1 (last commit)",
      cmdParts: ["git", "diff", "HEAD~1"],
      isGitDiff: true,
    };
  }

  // PR number or URL — normalize "PR #67", "PR 67", "#67" → "67"
  const prMatch = arg.match(/^(?:PR\s*)?#?(\d+)$/i);
  let prNum: string | null = prMatch ? prMatch[1] : null;
  if (!prNum && arg.includes("github.com") && arg.includes("/pull/")) {
    prNum = arg.replace(/\/$/, "").split("/").pop() ?? null;
  }
  if (prNum) {
    return {
      description: `PR #${prNum}`,
      cmdParts: ["gh", "pr", "diff", prNum],
      isGitDiff: false,
    };
  }

  // Branch ref (contains .. or ...)
  if (arg.includes("...") || arg.includes("..")) {
    return {
      description: arg,
      cmdParts: ["git", "diff", arg],
      isGitDiff: true,
    };
  }

  // File path(s) — check if any exist on disk
  const paths = arg.split(/\s+/);
  const existing = paths.filter((p) => existsSync(p));
  if (existing.length > 0) {
    return {
      description: `files: ${existing.join(", ")}`,
      cmdParts: null,
      isGitDiff: false,
    };
  }

  // Last resort: try as a git ref
  return { description: arg, cmdParts: ["git", "diff", arg], isGitDiff: true };
}

function skipFile(filename: string): boolean {
  const skips = [
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "/generated/",
    "generated/",
  ];
  return skips.some((p) => filename.includes(p));
}

function getFilesGit(cmdParts: string[]): {
  files: string[];
  deletedCount: number;
} {
  const r = spawnSync(cmdParts[0], [...cmdParts.slice(1), "--name-status"], {
    encoding: "utf-8",
  });
  if (r.status !== 0 || !r.stdout?.trim()) {
    return { files: [], deletedCount: 0 };
  }

  const files: string[] = [];
  let deleted = 0;
  for (const line of r.stdout.trim().split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const status = parts[0];
    if (status === "R100") continue;
    const filename =
      status.startsWith("R") && parts.length > 2 ? parts[2] : parts[1];
    if (skipFile(filename)) continue;
    if (status === "D") {
      deleted++;
      continue;
    }
    files.push(filename);
  }
  return { files, deletedCount: deleted };
}

function getFilesFromDiff(diffText: string): string[] {
  const files: string[] = [];
  for (const line of diffText.split("\n")) {
    if (line.startsWith("diff --git")) {
      const bIdx = line.indexOf(" b/");
      if (bIdx !== -1) {
        const f = line.slice(bIdx + 3);
        if (!skipFile(f)) files.push(f);
      }
    }
  }
  return files;
}

function groupFiles(files: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const f of files) {
    const parts = f.split("/");
    let key: string;
    if (parts.length === 1) {
      key = "root config";
    } else if (parts[0] === "src" && parts.length >= 2) {
      key = `src/${parts[1]}`;
    } else if (["test", "tests", "__tests__", "spec"].includes(parts[0])) {
      key = parts.length >= 2 ? `src/${parts[1]}` : "tests";
    } else {
      key = parts[0];
    }
    (groups[key] ??= []).push(f);
  }

  // Split large groups by next level
  const refined: Record<string, string[]> = {};
  for (const [key, flist] of Object.entries(groups)) {
    if (flist.length > 10 && key.includes("/")) {
      const subgroups: Record<string, string[]> = {};
      for (const f of flist) {
        const parts = f.split("/");
        const subkey = parts.length >= 3 ? parts.slice(0, 3).join("/") : key;
        (subgroups[subkey] ??= []).push(f);
      }
      if (Object.keys(subgroups).length > 1) {
        Object.assign(refined, subgroups);
      } else {
        refined[key] = flist;
      }
    } else {
      refined[key] = flist;
    }
  }

  // Merge single-file groups into nearest neighbor
  const final: Record<string, string[]> = {};
  const singles: Record<string, string[]> = {};
  for (const [key, flist] of Object.entries(refined)) {
    if (flist.length <= 1) {
      singles[key] = flist;
    } else {
      final[key] = flist;
    }
  }

  if (Object.keys(singles).length > 0) {
    if (Object.keys(final).length > 0) {
      const target =
        "root config" in final
          ? "root config"
          : Object.keys(final).reduce((a, b) =>
              final[a].length >= final[b].length ? a : b,
            );
      for (const flist of Object.values(singles)) {
        final[target].push(...flist);
      }
    } else {
      final["all files"] = Object.values(singles).flat();
    }
  }

  // Cap at MAX_GROUPS by merging smallest groups
  while (Object.keys(final).length > MAX_GROUPS) {
    const smallestKey = Object.keys(final).reduce((a, b) =>
      final[a].length <= final[b].length ? a : b,
    );
    const smallestFiles = final[smallestKey];
    delete final[smallestKey];

    // Merge into the most related group (longest common prefix) or the largest
    const bestTarget = Object.keys(final).reduce((a, b) => {
      const prefixA = commonPrefixLength(smallestKey, a);
      const prefixB = commonPrefixLength(smallestKey, b);
      if (prefixA !== prefixB) return prefixA > prefixB ? a : b;
      return final[a].length <= final[b].length ? a : b;
    });
    final[bestTarget].push(...smallestFiles);
  }

  return final;
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function filterDiffForFiles(rawDiff: string, targetFiles: string[]): string {
  const targetSet = new Set(targetFiles);
  const result: string[] = [];
  let currentFile: string | null = null;
  let currentLines: string[] = [];

  for (const line of rawDiff.split("\n")) {
    if (line.startsWith("diff --git")) {
      if (currentFile && targetSet.has(currentFile)) {
        result.push(...currentLines);
      }
      currentLines = [line];
      const bIdx = line.indexOf(" b/");
      currentFile = bIdx !== -1 ? line.slice(bIdx + 3) : null;
    } else {
      currentLines.push(line);
    }
  }

  if (currentFile && targetSet.has(currentFile)) {
    result.push(...currentLines);
  }
  return result.join("\n");
}

function main(): void {
  const rawArg = process.argv.slice(2).join(" ");
  const { description, cmdParts, isGitDiff } = detectTarget(rawArg);

  // Direct file review (no diff)
  if (cmdParts === null) {
    const filePaths = rawArg.split(/\s+/);
    const existing = filePaths.filter((p) => existsSync(p));
    if (existing.length === 0) {
      console.log(JSON.stringify({ error: "no_changes" }));
      return;
    }
    const tmpDir = mkdtempSync(join(tmpdir(), "review-"));
    const diffFile = join(tmpDir, "group-1.diff");
    const parts: string[] = [];
    for (const p of existing) {
      parts.push(`=== ${p} ===\n`);
      parts.push(readFileSync(p, "utf-8"));
      parts.push("\n");
    }
    writeFileSync(diffFile, parts.join(""));
    console.log(
      JSON.stringify({
        target: description,
        total_files: existing.length,
        deleted_files: 0,
        groups: [
          {
            name: "all files",
            files: existing,
            file_count: existing.length,
            diff_file: diffFile,
          },
        ],
      }),
    );
    return;
  }

  // Get file list
  let rawDiff: string | null = null;
  let deletedCount = 0;
  let files: string[];

  if (isGitDiff) {
    const result = getFilesGit(cmdParts);
    files = result.files;
    deletedCount = result.deletedCount;
  } else {
    const r = spawnSync(cmdParts[0], cmdParts.slice(1), {
      encoding: "utf-8",
    });
    if (r.status !== 0 || !r.stdout?.trim()) {
      if (r.status !== 0 && r.stderr?.trim()) {
        console.log(
          JSON.stringify({
            error: "command_failed",
            message: r.stderr.trim(),
          }),
        );
      } else {
        console.log(JSON.stringify({ error: "no_changes" }));
      }
      return;
    }
    rawDiff = r.stdout;
    files = getFilesFromDiff(rawDiff);
  }

  if (files.length === 0) {
    if (deletedCount > 0) {
      console.log(
        JSON.stringify({
          target: description,
          total_files: 0,
          deleted_files: deletedCount,
          groups: [],
          note: `${deletedCount} files were deleted (excluded from review).`,
        }),
      );
    } else {
      console.log(JSON.stringify({ error: "no_changes" }));
    }
    return;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "review-"));

  // Single group (<=5 files)
  if (files.length <= 5) {
    const diffFile = join(tmpDir, "group-1.diff");
    let diffContent: string;
    if (isGitDiff) {
      const r = spawnSync(cmdParts[0], [...cmdParts.slice(1), "--", ...files], {
        encoding: "utf-8",
      });
      diffContent = r.stdout ?? "";
    } else {
      diffContent = rawDiff!;
    }
    writeFileSync(diffFile, diffContent);
    console.log(
      JSON.stringify({
        target: description,
        total_files: files.length,
        deleted_files: deletedCount,
        groups: [
          {
            name: "all files",
            files,
            file_count: files.length,
            diff_file: diffFile,
          },
        ],
      }),
    );
    return;
  }

  // Multi-group (>5 files)
  const grouped = groupFiles(files);
  const groups: Array<{
    name: string;
    files: string[];
    file_count: number;
    diff_file: string;
  }> = [];

  const sortedEntries = Object.entries(grouped).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (let i = 0; i < sortedEntries.length; i++) {
    const [name, flist] = sortedEntries[i];
    const diffFile = join(tmpDir, `group-${i + 1}.diff`);
    let diffContent: string;
    if (isGitDiff) {
      const r = spawnSync(cmdParts[0], [...cmdParts.slice(1), "--", ...flist], {
        encoding: "utf-8",
      });
      diffContent = r.stdout ?? "";
    } else {
      diffContent = filterDiffForFiles(rawDiff!, flist);
    }
    writeFileSync(diffFile, diffContent);
    groups.push({
      name,
      files: flist,
      file_count: flist.length,
      diff_file: diffFile,
    });
  }

  console.log(
    JSON.stringify({
      target: description,
      total_files: files.length,
      deleted_files: deletedCount,
      groups,
    }),
  );
}

main();
