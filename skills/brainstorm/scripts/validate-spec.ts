/**
 * Spec completeness checker: validates that a brainstorm spec contains
 * all required sections with proper content.
 *
 * Stdin: the spec markdown text
 * Stdout: JSON validation report
 *
 * Usage:
 *     echo "$SPEC" | bun run validate-spec.ts
 */

import { readFileSync } from "node:fs";

type SectionCheck = {
  present: boolean;
  empty: boolean;
  [key: string]: boolean | number;
};

type Output = {
  complete: boolean;
  sections: Record<string, SectionCheck>;
  warnings: string[];
};

const OBSERVABLE_VERBS = [
  "renders", "returns", "shows", "creates", "saves", "displays",
  "logs", "throws", "rejects", "emits", "sends", "writes",
  "reads", "deletes", "updates", "redirects", "navigates",
  "opens", "closes", "hides", "enables", "disables", "validates",
  "accepts", "denies", "triggers", "fires", "calls", "invokes",
  "responds", "fetches", "loads", "submits", "publishes",
];

function extractSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = markdown.split("\n");
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    if (h2Match) {
      if (currentHeading) {
        sections.set(currentHeading, currentContent.join("\n").trim());
      }
      currentHeading = h2Match[1].trim();
      currentContent = [];
    } else if (currentHeading) {
      currentContent.push(line);
    }
  }
  if (currentHeading) {
    sections.set(currentHeading, currentContent.join("\n").trim());
  }

  return sections;
}

function findSection(sections: Map<string, string>, ...keywords: string[]): { heading: string; content: string } | null {
  for (const [heading, content] of sections) {
    const lower = heading.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      return { heading, content };
    }
  }
  return null;
}

function main(): void {
  const input = readFileSync("/dev/stdin", "utf-8").trim();
  if (!input) {
    console.error("No spec content provided on stdin");
    process.exit(1);
  }

  const sections = extractSections(input);
  const warnings: string[] = [];
  const result: Record<string, SectionCheck> = {};

  // 1. Problem Statement
  const problemSection = findSection(sections, "problem");
  result.problem_statement = {
    present: !!problemSection,
    empty: !problemSection || problemSection.content.length === 0,
  };
  if (!problemSection) warnings.push("Missing Problem Statement section");
  else if (problemSection.content.length === 0) warnings.push("Problem Statement section is empty");

  // 2. Scope
  const scopeSection = findSection(sections, "scope");
  const hasAffected = !!scopeSection && /affected\s*(files|components)/i.test(scopeSection.content);
  const hasNewFiles = !!scopeSection && /new\s*files/i.test(scopeSection.content);
  const hasOutOfScope = !!scopeSection && /out\s*of\s*scope/i.test(scopeSection.content);
  result.scope = {
    present: !!scopeSection,
    empty: !scopeSection || scopeSection.content.length === 0,
    has_affected: hasAffected,
    has_new_files: hasNewFiles,
    has_out_of_scope: hasOutOfScope,
  };
  if (!scopeSection) warnings.push("Missing Scope section");
  if (scopeSection && !hasAffected) warnings.push("Scope section missing 'Affected files/components'");
  if (scopeSection && !hasOutOfScope) warnings.push("Scope section missing 'Out of scope'");

  // 3. Requirements
  const reqSection = findSection(sections, "requirement");
  const mustCount = reqSection ? (reqSection.content.match(/\[MUST\]/gi) ?? []).length : 0;
  const shouldCount = reqSection ? (reqSection.content.match(/\[SHOULD\]/gi) ?? []).length : 0;
  result.requirements = {
    present: !!reqSection,
    empty: !reqSection || reqSection.content.length === 0,
    must_count: mustCount,
    should_count: shouldCount,
  };
  if (!reqSection) warnings.push("Missing Requirements section");
  else if (mustCount === 0) warnings.push("Requirements section has no [MUST] markers");

  // 4. Behavior
  const behaviorSection = findSection(sections, "behavior");
  const hasHappyPath = !!behaviorSection && /happy\s*path/i.test(behaviorSection.content);
  const hasEdgeCases = !!behaviorSection && /edge\s*case/i.test(behaviorSection.content);
  result.behavior = {
    present: !!behaviorSection,
    empty: !behaviorSection || behaviorSection.content.length === 0,
    has_happy_path: hasHappyPath,
    has_edge_cases: hasEdgeCases,
  };
  if (!behaviorSection) warnings.push("Missing Behavior section");
  if (behaviorSection && !hasHappyPath) warnings.push("Behavior section missing Happy Path");
  if (behaviorSection && !hasEdgeCases) warnings.push("Behavior section missing Edge Cases");
  if (behaviorSection && hasEdgeCases) {
    // Count edge case items
    const edgeCaseStart = behaviorSection.content.indexOf("Edge Case");
    if (edgeCaseStart !== -1) {
      const edgeCaseContent = behaviorSection.content.slice(edgeCaseStart);
      const items = edgeCaseContent.match(/^- /gm) ?? [];
      if (items.length <= 1) warnings.push("Edge Cases section has only 1 item — consider more");
    }
  }

  // 5. Technical Notes
  const techSection = findSection(sections, "technical");
  result.technical_notes = {
    present: !!techSection,
    empty: !techSection || techSection.content.length === 0,
  };
  if (!techSection) warnings.push("Missing Technical Notes section");
  else if (techSection.content.length === 0) warnings.push("Technical Notes section is empty");

  // 6. Success Criteria
  const successSection = findSection(sections, "success", "criteria");
  const criteriaItems = successSection ? (successSection.content.match(/- \[ \]/g) ?? []).length : 0;
  const hasObservable = successSection
    ? OBSERVABLE_VERBS.some((verb) => successSection.content.toLowerCase().includes(verb))
    : false;
  result.success_criteria = {
    present: !!successSection,
    empty: !successSection || successSection.content.length === 0,
    criteria_count: criteriaItems,
    observable: hasObservable,
  };
  if (!successSection) warnings.push("Missing Success Criteria section");
  else {
    if (criteriaItems === 0) warnings.push("Success Criteria has no checkbox items (- [ ])");
    if (!hasObservable) warnings.push("Success Criteria lacks observable verbs (renders, returns, shows, creates, etc.)");
  }

  // Determine completeness
  const requiredSections = ["problem_statement", "scope", "requirements", "behavior", "technical_notes", "success_criteria"];
  const allPresent = requiredSections.every((key) => result[key]?.present);
  const noneEmpty = requiredSections.every((key) => !result[key]?.empty);

  const output: Output = {
    complete: allPresent && noneEmpty && warnings.length === 0,
    sections: result,
    warnings,
  };

  console.log(JSON.stringify(output));
}

main();
