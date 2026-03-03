/**
 * Review consolidation: parses agent markdown outputs, deduplicates findings,
 * sorts by severity, and produces structured JSON for the report.
 *
 * Stdin: JSON array of agent result strings (raw markdown from each code-reviewer agent)
 * Stdout: JSON with structured report data
 *
 * Usage:
 *     echo '["agent1 markdown...", "agent2 markdown..."]' | bun run consolidate.ts
 */

type Finding = {
  severity: "CRIT" | "WARN" | "INFO";
  title: string;
  location: string;
  confidence: number;
  group: string;
  signal: string;
  evidence: string;
  impact: string;
  dimension: string;
};

type Output = {
  target: string;
  metrics: {
    files: number;
    reviewers: number;
    suppressed: number;
  };
  findings: {
    critical: Finding[];
    warnings: Finding[];
    info: Finding[];
  };
};

function parseSeverity(raw: string): "CRIT" | "WARN" | "INFO" {
  const upper = raw.toUpperCase().trim();
  if (upper.includes("CRIT") || upper.includes("HIGH") || upper.includes("CRITICAL")) return "CRIT";
  if (upper.includes("WARN") || upper.includes("MEDIUM") || upper.includes("WARNING")) return "WARN";
  return "INFO";
}

function parseFindings(markdown: string): {
  findings: Finding[];
  filesReviewed: number;
  suppressed: number;
  group: string;
} {
  const findings: Finding[] = [];
  let filesReviewed = 0;
  let suppressed = 0;
  let group = "";

  // Extract group name from "reviewing group N of M: <name>" pattern
  const groupMatch = markdown.match(/reviewing group \d+ of \d+:\s*(.+)/i);
  if (groupMatch) {
    group = groupMatch[1].trim().replace(/[.*]/, "");
  }

  // Extract files reviewed count
  const filesMatch = markdown.match(/files?\s*reviewed[:\s]*(\d+)/i)
    ?? markdown.match(/reviewed\s+(\d+)\s+files?/i);
  if (filesMatch) {
    filesReviewed = parseInt(filesMatch[1], 10);
  }

  // Extract suppressed count
  const suppressedMatch = markdown.match(/suppressed[:\s]*(\d+)/i)
    ?? markdown.match(/(\d+)\s+suppressed/i)
    ?? markdown.match(/below threshold[:\s]*(\d+)/i);
  if (suppressedMatch) {
    suppressed = parseInt(suppressedMatch[1], 10);
  }

  // Parse table rows: | # | Finding | Location | Confidence | ...
  // The code-reviewer agent outputs findings in markdown tables
  const tableRowRegex = /^\|\s*\d+\s*\|\s*(.+?)\s*\|\s*`?([^|`]+)`?\s*\|\s*(\d+)%?\s*\|/gm;
  let match: RegExpExecArray | null;
  while ((match = tableRowRegex.exec(markdown)) !== null) {
    findings.push({
      severity: "INFO", // will be classified by section header
      title: match[1].trim(),
      location: match[2].trim(),
      confidence: parseInt(match[3], 10),
      group,
      signal: "",
      evidence: "",
      impact: "",
      dimension: "",
    });
  }

  // Determine severity from section headers
  // Walk through the markdown and assign severity based on the current section
  const lines = markdown.split("\n");
  let currentSeverity: "CRIT" | "WARN" | "INFO" = "INFO";
  let tableRowIndex = 0;

  for (const line of lines) {
    // Detect severity section headers
    if (/^#{1,3}\s.*critical/i.test(line) || /^#{1,3}\s.*crit/i.test(line) || /^#{1,3}\s.*high/i.test(line)) {
      currentSeverity = "CRIT";
    } else if (/^#{1,3}\s.*warning/i.test(line) || /^#{1,3}\s.*warn/i.test(line) || /^#{1,3}\s.*medium/i.test(line)) {
      currentSeverity = "WARN";
    } else if (/^#{1,3}\s.*info/i.test(line) || /^#{1,3}\s.*low/i.test(line) || /^#{1,3}\s.*note/i.test(line)) {
      currentSeverity = "INFO";
    }

    // Match table rows to assign severity
    if (/^\|\s*\d+\s*\|/.test(line) && tableRowIndex < findings.length) {
      findings[tableRowIndex].severity = currentSeverity;
      tableRowIndex++;
    }
  }

  // Parse detail blocks for signal, evidence, impact
  // Pattern: **N. Title**\n paragraph with details
  const detailRegex = /\*\*(\d+)\.\s*(.+?)\*\*\s*\n([\s\S]*?)(?=\*\*\d+\.|#{1,3}\s|$)/g;
  let detailMatch: RegExpExecArray | null;
  while ((detailMatch = detailRegex.exec(markdown)) !== null) {
    const idx = parseInt(detailMatch[1], 10) - 1;
    const body = detailMatch[3].trim();

    // Try to extract structured fields from the detail block
    const signalMatch = body.match(/signal[:\s]*(.+?)(?:\n|$)/i);
    const evidenceMatch = body.match(/evidence[:\s]*(.+?)(?:\n|$)/i);
    const impactMatch = body.match(/impact[:\s]*(.+?)(?:\n|$)/i);
    const dimensionMatch = body.match(/dimension[:\s]*(.+?)(?:\n|$)/i);

    // Find the finding that matches this detail index in the current severity group
    // We need to map detail numbers back to findings
    if (idx >= 0 && idx < findings.length) {
      if (signalMatch) findings[idx].signal = signalMatch[1].trim();
      if (evidenceMatch) findings[idx].evidence = evidenceMatch[1].trim();
      if (impactMatch) findings[idx].impact = impactMatch[1].trim();
      if (dimensionMatch) findings[idx].dimension = dimensionMatch[1].trim();

      // If no structured fields, use the whole body as evidence
      if (!signalMatch && !evidenceMatch && !impactMatch && body.length > 0) {
        findings[idx].evidence = body.slice(0, 500);
      }
    }
  }

  return { findings, filesReviewed, suppressed, group };
}

function deduplicate(findings: Finding[]): Finding[] {
  const byLocation = new Map<string, Finding>();

  for (const f of findings) {
    const key = f.location;
    const existing = byLocation.get(key);
    if (!existing || f.confidence > existing.confidence) {
      byLocation.set(key, f);
    }
  }

  return Array.from(byLocation.values());
}

function severityOrder(s: "CRIT" | "WARN" | "INFO"): number {
  if (s === "CRIT") return 0;
  if (s === "WARN") return 1;
  return 2;
}

function main(): void {
  const input = require("fs").readFileSync("/dev/stdin", "utf-8").trim();

  let agentResults: string[];
  try {
    agentResults = JSON.parse(input);
  } catch {
    console.error("Failed to parse stdin as JSON array");
    process.exit(1);
  }

  if (!Array.isArray(agentResults)) {
    console.error("Stdin must be a JSON array of strings");
    process.exit(1);
  }

  let totalFiles = 0;
  let totalSuppressed = 0;
  const allFindings: Finding[] = [];

  for (const result of agentResults) {
    const parsed = parseFindings(result);
    totalFiles += parsed.filesReviewed;
    totalSuppressed += parsed.suppressed;
    allFindings.push(...parsed.findings);
  }

  const deduped = deduplicate(allFindings);

  // Sort: CRIT → WARN → INFO, stable within each bucket (by confidence desc)
  deduped.sort((a, b) => {
    const sevDiff = severityOrder(a.severity) - severityOrder(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  const output: Output = {
    target: "",
    metrics: {
      files: totalFiles,
      reviewers: agentResults.length,
      suppressed: totalSuppressed,
    },
    findings: {
      critical: deduped.filter((f) => f.severity === "CRIT"),
      warnings: deduped.filter((f) => f.severity === "WARN"),
      info: deduped.filter((f) => f.severity === "INFO"),
    },
  };

  console.log(JSON.stringify(output));
}

main();
