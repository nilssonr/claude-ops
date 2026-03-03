import { readFileSync } from "node:fs";

/**
 * Skill quality checker: evaluates a SKILL.md against the quality audit checklist.
 * Mechanically checks structural items (F1-F6, S1-S3, S5-S6, Q1-Q3, Q5, T1, T3).
 * Items requiring LLM judgment (Q4, Q6, S4) are marked SKIPPED.
 *
 * Usage:
 *     bun run audit.ts <path-to-SKILL.md>
 */

type Status = "PASS" | "WARN" | "FAIL" | "SKIPPED";

type CheckResult = {
  id: string;
  check: string;
  status: Status;
  detail: string;
};

type AuditOutput = {
  path: string;
  line_count: number;
  results: CheckResult[];
  score: {
    pass: number;
    warn: number;
    fail: number;
    skipped: number;
    percentage: number;
  };
  rating: string;
};

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fm: Record<string, string> = {};
  const raw = match[1];
  // Simple YAML parser for flat key-value pairs (handles multiline >- descriptions)
  let currentKey = "";
  let currentValue = "";

  for (const line of raw.split("\n")) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      if (currentKey) fm[currentKey] = currentValue.trim();
      currentKey = kvMatch[1];
      currentValue = kvMatch[2].replace(/^>-?\s*$/, "");
    } else if (currentKey && /^\s+/.test(line)) {
      currentValue += " " + line.trim();
    }
  }
  if (currentKey) fm[currentKey] = currentValue.trim();

  return { frontmatter: fm, body: match[2] };
}

function checkF1(fm: Record<string, string>): CheckResult {
  const name = fm.name ?? "";
  if (!name) return { id: "F1", check: "name format", status: "FAIL", detail: "name field missing" };
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    const wordCount = name.split("-").length;
    if (wordCount <= 3) return { id: "F1", check: "name format", status: "PASS", detail: name };
    return { id: "F1", check: "name format", status: "WARN", detail: `${name} (${wordCount} words, target 1-3)` };
  }
  return { id: "F1", check: "name format", status: "FAIL", detail: `'${name}' not lowercase-hyphenated` };
}

function checkF2(fm: Record<string, string>): CheckResult {
  const desc = fm.description ?? "";
  const hasTrigger = /TRIGGER when/i.test(desc);
  const hasDoNotTrigger = /DO NOT TRIGGER/i.test(desc);
  if (hasTrigger && hasDoNotTrigger) return { id: "F2", check: "TRIGGER clauses", status: "PASS", detail: "both present" };
  if (hasTrigger || hasDoNotTrigger) return { id: "F2", check: "TRIGGER clauses", status: "WARN", detail: `${hasTrigger ? "TRIGGER" : ""} ${hasDoNotTrigger ? "DO NOT TRIGGER" : ""} present`.trim() };
  return { id: "F2", check: "TRIGGER clauses", status: "FAIL", detail: "neither TRIGGER nor DO NOT TRIGGER found" };
}

function checkF3(fm: Record<string, string>): CheckResult {
  const desc = fm.description ?? "";
  const firstPersonPatterns = /\b(I |you |your |my |we |our )\b/gi;
  const matches = desc.match(firstPersonPatterns);
  if (!matches) return { id: "F3", check: "third-person voice", status: "PASS", detail: "no first/second-person pronouns" };
  // Filter out matches inside TRIGGER examples (quoted strings)
  const nonQuoted = matches.filter((m) => {
    const idx = desc.indexOf(m);
    const before = desc.slice(0, idx);
    const inQuote = (before.match(/"/g)?.length ?? 0) % 2 === 1;
    return !inQuote;
  });
  if (nonQuoted.length === 0) return { id: "F3", check: "third-person voice", status: "PASS", detail: "pronouns only in quoted text" };
  if (nonQuoted.length <= 2) return { id: "F3", check: "third-person voice", status: "WARN", detail: `${nonQuoted.length} pronoun(s) found` };
  return { id: "F3", check: "third-person voice", status: "FAIL", detail: `${nonQuoted.length} first/second-person pronouns` };
}

function checkF4(fm: Record<string, string>): CheckResult {
  if ("user-invocable" in fm) return { id: "F4", check: "user-invocable set", status: "PASS", detail: fm["user-invocable"] };
  return { id: "F4", check: "user-invocable set", status: "FAIL", detail: "missing" };
}

function checkF5(fm: Record<string, string>): CheckResult {
  const tools = fm["allowed-tools"] ?? "";
  if (!tools) return { id: "F5", check: "allowed-tools present", status: "FAIL", detail: "missing" };
  const list = tools.split(",").map((t) => t.trim());
  if (list.length === 0) return { id: "F5", check: "allowed-tools present", status: "FAIL", detail: "empty" };
  return { id: "F5", check: "allowed-tools present", status: "PASS", detail: `${list.length} tools: ${list.join(", ")}` };
}

function checkF6(fm: Record<string, string>): CheckResult {
  const isInvocable = fm["user-invocable"] === "true";
  const hasHint = "argument-hint" in fm && fm["argument-hint"].trim().length > 0;
  if (!isInvocable) return { id: "F6", check: "argument-hint", status: "PASS", detail: "not user-invocable, hint not required" };
  if (hasHint) return { id: "F6", check: "argument-hint", status: "PASS", detail: fm["argument-hint"] };
  return { id: "F6", check: "argument-hint", status: "WARN", detail: "user-invocable but no argument-hint" };
}

function checkS1(body: string): CheckResult {
  if (/\*\*Announce to the user: "Skill activated:/.test(body)) return { id: "S1", check: "announcement line", status: "PASS", detail: "present" };
  if (/Skill activated/i.test(body)) return { id: "S1", check: "announcement line", status: "WARN", detail: "present but non-standard format" };
  return { id: "S1", check: "announcement line", status: "FAIL", detail: "missing" };
}

function checkS2(body: string): CheckResult {
  const hasH1 = /^# .+/m.test(body);
  const hasRole = /You are /m.test(body) || /You (?:orchestrate|manage|enforce|create|build|gather)/m.test(body);
  if (hasH1 && hasRole) return { id: "S2", check: "title + role", status: "PASS", detail: "H1 title and role statement found" };
  if (hasH1) return { id: "S2", check: "title + role", status: "WARN", detail: "H1 title found but no clear role statement" };
  return { id: "S2", check: "title + role", status: "FAIL", detail: "missing H1 title" };
}

function checkS3(body: string): CheckResult {
  const numberedSections = body.match(/^## \d+\./gm);
  if (numberedSections && numberedSections.length >= 2) return { id: "S3", check: "numbered sections", status: "PASS", detail: `${numberedSections.length} numbered sections` };
  const h2Sections = body.match(/^## /gm);
  if (h2Sections && h2Sections.length >= 2) return { id: "S3", check: "numbered sections", status: "WARN", detail: `${h2Sections.length} H2 sections but not numbered` };
  return { id: "S3", check: "numbered sections", status: "FAIL", detail: "no structured sections" };
}

function checkS4(): CheckResult {
  return { id: "S4", check: "progressive disclosure", status: "SKIPPED", detail: "requires LLM judgment" };
}

function checkS5(lineCount: number): CheckResult {
  if (lineCount < 400) return { id: "S5", check: "line count", status: "PASS", detail: `${lineCount} lines` };
  if (lineCount <= 500) return { id: "S5", check: "line count", status: "WARN", detail: `${lineCount} lines (target: < 400)` };
  return { id: "S5", check: "line count", status: "FAIL", detail: `${lineCount} lines (target: < 500)` };
}

function checkS6(lineCount: number, body: string): CheckResult {
  if (lineCount <= 500) return { id: "S6", check: "supporting files extracted", status: "PASS", detail: "under 500 lines, no extraction needed" };
  const hasRefs = /references\//.test(body) || /templates\//.test(body);
  if (hasRefs) return { id: "S6", check: "supporting files extracted", status: "WARN", detail: `${lineCount} lines, some content extracted` };
  return { id: "S6", check: "supporting files extracted", status: "FAIL", detail: `${lineCount} lines with no supporting files` };
}

function checkQ1(body: string): CheckResult {
  const mustCount = (body.match(/\bMUST\b|\bAlways\b|\bNever\b/g) ?? []).length;
  const preferCount = (body.match(/\bPrefer\b|\bDefault to\b/g) ?? []).length;
  const considerCount = (body.match(/\bConsider\b|\bWhen practical\b/g) ?? []).length;
  const vagueCount = (body.match(/\btry to\b|\bshould try\b|\bit's good practice\b/gi) ?? []).length;

  const markerTotal = mustCount + preferCount + considerCount;
  if (vagueCount > 0 && markerTotal < vagueCount) {
    return { id: "Q1", check: "degrees of freedom", status: "WARN", detail: `${vagueCount} vague phrases vs ${markerTotal} explicit markers` };
  }
  if (markerTotal > 0) return { id: "Q1", check: "degrees of freedom", status: "PASS", detail: `MUST:${mustCount} Prefer:${preferCount} Consider:${considerCount}` };
  return { id: "Q1", check: "degrees of freedom", status: "WARN", detail: "no explicit degree-of-freedom markers found" };
}

function checkQ2(body: string): CheckResult {
  const codeBlocks = body.match(/```[\s\S]*?```/g) ?? [];
  if (codeBlocks.length >= 3) return { id: "Q2", check: "code examples", status: "PASS", detail: `${codeBlocks.length} code blocks` };
  if (codeBlocks.length > 0) return { id: "Q2", check: "code examples", status: "WARN", detail: `${codeBlocks.length} code block(s), consider adding more` };
  return { id: "Q2", check: "code examples", status: "FAIL", detail: "no code examples" };
}

function checkQ3(body: string): CheckResult {
  const tables = body.match(/^\|.*\|.*\|/gm) ?? [];
  // Filter out header separator lines
  const contentRows = tables.filter((t) => !/^\|[\s-|]+\|$/.test(t));
  if (contentRows.length >= 3) return { id: "Q3", check: "tables/comparisons", status: "PASS", detail: `${contentRows.length} table rows` };
  if (contentRows.length > 0) return { id: "Q3", check: "tables/comparisons", status: "WARN", detail: `${contentRows.length} table row(s)` };
  return { id: "Q3", check: "tables/comparisons", status: "FAIL", detail: "no tables" };
}

function checkQ4(): CheckResult {
  return { id: "Q4", check: "grounded in docs", status: "SKIPPED", detail: "requires LLM judgment" };
}

function checkQ5(body: string): CheckResult {
  const checkboxes = body.match(/- \[ \]/g) ?? [];
  const numberedEnd = body.match(/^\d+\.\s/gm) ?? [];
  if (checkboxes.length >= 3) return { id: "Q5", check: "quality checklist", status: "PASS", detail: `${checkboxes.length} checklist items` };
  if (checkboxes.length > 0 || numberedEnd.length >= 5) return { id: "Q5", check: "quality checklist", status: "WARN", detail: `${checkboxes.length} checkbox(es), ${numberedEnd.length} numbered items` };
  return { id: "Q5", check: "quality checklist", status: "WARN", detail: "no checklist found" };
}

function checkQ6(): CheckResult {
  return { id: "Q6", check: "factual accuracy", status: "SKIPPED", detail: "requires LLM judgment" };
}

function checkT1(fm: Record<string, string>, body: string): CheckResult {
  const allowedRaw = fm["allowed-tools"] ?? "";
  const allowed = new Set(allowedRaw.split(",").map((t) => t.trim()).filter(Boolean));

  // Tools that might be referenced in the body
  const toolPatterns: Record<string, RegExp> = {
    Read: /\bRead\b(?! more| the| this| it| all| about)/,
    Write: /\bWrite\b(?! a | the | to | in )/,
    Edit: /\bEdit\b(?! the)/,
    Bash: /\bBash\b|```bash|`bun run|`git |`npm |`gh /,
    Grep: /\bGrep\b/,
    Glob: /\bGlob\b/,
    Agent: /\bAgent\b(?! tool| type)/,
    WebSearch: /\bWebSearch\b/,
    WebFetch: /\bWebFetch\b/,
  };

  const referenced = new Set<string>();
  for (const [tool, pattern] of Object.entries(toolPatterns)) {
    if (pattern.test(body)) referenced.add(tool);
  }

  const inAllowedNotReferenced = [...allowed].filter((t) => !referenced.has(t));
  const referencedNotAllowed = [...referenced].filter((t) => !allowed.has(t));

  if (inAllowedNotReferenced.length === 0 && referencedNotAllowed.length === 0) {
    return { id: "T1", check: "tool list matches usage", status: "PASS", detail: "exact match" };
  }

  const details: string[] = [];
  if (inAllowedNotReferenced.length > 0) details.push(`allowed but not referenced: ${inAllowedNotReferenced.join(", ")}`);
  if (referencedNotAllowed.length > 0) details.push(`referenced but not allowed: ${referencedNotAllowed.join(", ")}`);

  if (referencedNotAllowed.length > 0) return { id: "T1", check: "tool list matches usage", status: "FAIL", detail: details.join("; ") };
  return { id: "T1", check: "tool list matches usage", status: "WARN", detail: details.join("; ") };
}

function checkT3(fm: Record<string, string>): CheckResult {
  const allowed = fm["allowed-tools"] ?? "";
  const interactive = ["AskUserQuestion", "EnterPlanMode", "ExitPlanMode"];
  const found = interactive.filter((t) => allowed.includes(t));
  if (found.length === 0) return { id: "T3", check: "no interactive tools", status: "PASS", detail: "none found in allowed-tools" };
  return { id: "T3", check: "no interactive tools", status: "FAIL", detail: `interactive tools in allowed-tools: ${found.join(", ")}` };
}

function main(): void {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: bun run audit.ts <path-to-SKILL.md>");
    process.exit(1);
  }

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const lineCount = content.split("\n").length;
  const { frontmatter, body } = parseFrontmatter(content);

  const results: CheckResult[] = [
    // Frontmatter Quality
    checkF1(frontmatter),
    checkF2(frontmatter),
    checkF3(frontmatter),
    checkF4(frontmatter),
    checkF5(frontmatter),
    checkF6(frontmatter),
    // Content Structure
    checkS1(body),
    checkS2(body),
    checkS3(body),
    checkS4(),
    checkS5(lineCount),
    checkS6(lineCount, body),
    // Content Quality
    checkQ1(body),
    checkQ2(body),
    checkQ3(body),
    checkQ4(),
    checkQ5(body),
    checkQ6(),
    // Tool Usage
    checkT1(frontmatter, body),
    checkT3(frontmatter),
  ];

  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;
  const scorable = pass + warn + fail;
  const points = pass * 2 + warn * 1;
  const maxPoints = scorable * 2;
  const percentage = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

  let rating: string;
  if (percentage >= 90) rating = "Excellent";
  else if (percentage >= 75) rating = "Good";
  else if (percentage >= 60) rating = "Needs improvement";
  else rating = "Major issues";

  const output: AuditOutput = {
    path: filePath,
    line_count: lineCount,
    results,
    score: { pass, warn, fail, skipped, percentage },
    rating,
  };

  console.log(JSON.stringify(output));
}

main();
