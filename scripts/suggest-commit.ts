import { spawnSync } from "node:child_process";

/**
 * Commit type/scope pre-classifier: reads staged git changes and suggests
 * conventional commit type and scope from file-path heuristics.
 *
 * Usage:
 *     bun run suggest-commit.ts
 */

type Confidence = "high" | "medium" | "low";

type Output = {
  suggested_type: string | null;
  suggested_scope: string | null;
  type_confidence: Confidence;
  scope_confidence: Confidence;
  files_changed: number;
  insertions: number;
  deletions: number;
  file_list: string[];
};

function git(...args: string[]): string {
  const r = spawnSync("git", args, { encoding: "utf-8" });
  return r.status === 0 ? (r.stdout?.trim() ?? "") : "";
}

function classifyType(files: string[]): { type: string | null; confidence: Confidence } {
  if (files.length === 0) return { type: null, confidence: "low" };

  const categories = {
    test: 0,
    docs: 0,
    ci: 0,
    build: 0,
    style: 0,
    other: 0,
  };

  const testPatterns = [
    /\btest[s]?\//i,
    /__tests__\//,
    /\.test\.\w+$/,
    /\.spec\.\w+$/,
    /\btesting\//i,
  ];
  const docPatterns = [
    /\bdocs?\//i,
    /\.md$/i,
    /README/i,
    /CHANGELOG/i,
    /LICENSE/i,
  ];
  const ciPatterns = [
    /\.github\//,
    /Jenkinsfile/i,
    /\.gitlab-ci/,
    /\.circleci\//,
    /\.travis/i,
    /Dockerfile/i,
    /docker-compose/i,
  ];
  const buildPatterns = [
    /^package\.json$/,
    /^package-lock\.json$/,
    /^pnpm-lock\.yaml$/,
    /^yarn\.lock$/,
    /^bun\.lock$/,
    /tsconfig/i,
    /vite\.config/i,
    /webpack/i,
    /rollup/i,
    /esbuild/i,
    /babel/i,
    /\.eslintrc/i,
    /eslint\.config/i,
    /\.prettierrc/i,
    /prettier\.config/i,
    /Makefile/i,
    /CMakeLists/i,
  ];
  const stylePatterns = [
    /\.css$/,
    /\.scss$/,
    /\.less$/,
    /\.sass$/,
    /\.stylelintrc/i,
    /stylelint\.config/i,
  ];

  for (const file of files) {
    if (testPatterns.some((p) => p.test(file))) { categories.test++; continue; }
    if (docPatterns.some((p) => p.test(file))) { categories.docs++; continue; }
    if (ciPatterns.some((p) => p.test(file))) { categories.ci++; continue; }
    if (buildPatterns.some((p) => p.test(file))) { categories.build++; continue; }
    if (stylePatterns.some((p) => p.test(file))) { categories.style++; continue; }
    categories.other++;
  }

  const total = files.length;

  // If all files match a single category
  if (categories.test === total) return { type: "test", confidence: "high" };
  if (categories.docs === total) return { type: "docs", confidence: "high" };
  if (categories.ci === total) return { type: "ci", confidence: "high" };
  if (categories.build === total) return { type: "build", confidence: "high" };
  if (categories.style === total) return { type: "style", confidence: "high" };

  // If most files match a category (>= 70%)
  if (categories.test / total >= 0.7) return { type: "test", confidence: "medium" };
  if (categories.docs / total >= 0.7) return { type: "docs", confidence: "medium" };
  if (categories.ci / total >= 0.7) return { type: "ci", confidence: "medium" };
  if (categories.build / total >= 0.7) return { type: "build", confidence: "medium" };
  if (categories.style / total >= 0.7) return { type: "style", confidence: "medium" };

  // Mixed — let LLM decide
  return { type: null, confidence: "low" };
}

function classifyScope(files: string[]): { scope: string | null; confidence: Confidence } {
  if (files.length === 0) return { scope: null, confidence: "low" };

  // Extract directory paths
  const dirs = files.map((f) => {
    const parts = f.split("/");
    if (parts.length === 1) return null; // root file
    // Skip the top-level directory if it's src/, app/, lib/, etc.
    const topLevel = ["src", "app", "lib", "packages", "modules"];
    if (topLevel.includes(parts[0]) && parts.length >= 2) {
      return parts[1];
    }
    return parts[0];
  });

  // If all files are in root
  if (dirs.every((d) => d === null)) {
    if (files.length === 1) {
      // Use the filename stem as scope
      const stem = files[0].replace(/\.\w+$/, "");
      return { scope: stem, confidence: "low" };
    }
    return { scope: null, confidence: "low" };
  }

  // Filter out null (root files) for scope analysis
  const nonNullDirs = dirs.filter((d): d is string => d !== null);
  if (nonNullDirs.length === 0) return { scope: null, confidence: "low" };

  // Check if all non-root files share a common directory
  const uniqueDirs = new Set(nonNullDirs);
  if (uniqueDirs.size === 1) {
    const scope = [...uniqueDirs][0];
    // High confidence if all files are in this scope, medium if some are root
    const confidence: Confidence = nonNullDirs.length === files.length ? "high" : "medium";
    return { scope, confidence };
  }

  // If 2 directories and one is a test directory for the other
  if (uniqueDirs.size === 2) {
    const dirArray = [...uniqueDirs];
    const isTestRelated = dirArray.some((d) => /test/i.test(d));
    if (isTestRelated) {
      const nonTestDir = dirArray.find((d) => !/test/i.test(d));
      if (nonTestDir) return { scope: nonTestDir, confidence: "medium" };
    }
  }

  // Mixed — let LLM decide
  return { scope: null, confidence: "low" };
}

function parseDiffStats(statOutput: string): { insertions: number; deletions: number } {
  let insertions = 0;
  let deletions = 0;

  const summaryMatch = statOutput.match(/(\d+) insertions?\(\+\)/);
  const deleteMatch = statOutput.match(/(\d+) deletions?\(-\)/);

  if (summaryMatch) insertions = parseInt(summaryMatch[1], 10);
  if (deleteMatch) deletions = parseInt(deleteMatch[1], 10);

  return { insertions, deletions };
}

function main(): void {
  // Get staged file list
  const nameOnly = git("diff", "--cached", "--name-only");
  if (!nameOnly) {
    console.log(JSON.stringify({
      suggested_type: null,
      suggested_scope: null,
      type_confidence: "low",
      scope_confidence: "low",
      files_changed: 0,
      insertions: 0,
      deletions: 0,
      file_list: [],
    }));
    return;
  }

  const files = nameOnly.split("\n").filter(Boolean);
  const stat = git("diff", "--cached", "--stat");
  const { insertions, deletions } = parseDiffStats(stat);
  const { type, confidence: typeConf } = classifyType(files);
  const { scope, confidence: scopeConf } = classifyScope(files);

  const output: Output = {
    suggested_type: type,
    suggested_scope: scope,
    type_confidence: typeConf,
    scope_confidence: scopeConf,
    files_changed: files.length,
    insertions,
    deletions,
    file_list: files,
  };

  console.log(JSON.stringify(output));
}

main();
