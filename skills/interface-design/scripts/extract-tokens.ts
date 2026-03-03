import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * Design token scanner: scans UI files for spacing, radius, color, shadow,
 * and typography values. Reports frequency counts to inform design system creation.
 *
 * Usage:
 *     bun run extract-tokens.ts [directory]    # default: scans common UI paths
 */

type TokenFrequencies = Record<string, number>;

type Output = {
  files_scanned: number;
  spacing: TokenFrequencies;
  radius: TokenFrequencies;
  colors: TokenFrequencies;
  shadows: TokenFrequencies;
  typography: TokenFrequencies;
  suggested_base_unit: number;
  depth_strategy: string;
};

function findFiles(dir: string): string[] {
  const result = spawnSync(
    "find",
    [dir, "-type", "f", "-name", "*.tsx", "-o", "-name", "*.jsx", "-o", "-name", "*.vue", "-o", "-name", "*.svelte", "-o", "-name", "*.css"],
    { encoding: "utf-8" },
  );
  if (result.status !== 0 || !result.stdout?.trim()) return [];
  return result.stdout.trim().split("\n").filter((f) => !f.includes("node_modules") && !f.includes(".next") && !f.includes("dist"));
}

function increment(map: TokenFrequencies, key: string, count = 1): void {
  map[key] = (map[key] ?? 0) + count;
}

function extractSpacing(content: string, spacing: TokenFrequencies): void {
  // Tailwind spacing classes: p-N, px-N, py-N, pt-N, pr-N, pb-N, pl-N, m-N, mx-N, my-N, etc., gap-N, space-x-N, space-y-N
  const twSpacing = /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-(\d+(?:\.\d+)?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = twSpacing.exec(content)) !== null) {
    increment(spacing, match[1]);
  }

  // CSS spacing values: padding: Npx, margin: Npx, gap: Npx
  const cssSpacing = /(?:padding|margin|gap|padding-(?:top|right|bottom|left)|margin-(?:top|right|bottom|left))\s*:\s*(\d+)px/g;
  while ((match = cssSpacing.exec(content)) !== null) {
    increment(spacing, match[1] + "px");
  }
}

function extractRadius(content: string, radius: TokenFrequencies): void {
  // Tailwind rounded classes
  const twRadius = /\brounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?\b/g;
  let match: RegExpExecArray | null;
  while ((match = twRadius.exec(content)) !== null) {
    increment(radius, match[1] ?? "DEFAULT");
  }

  // CSS border-radius
  const cssRadius = /border-radius\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em|%))/g;
  while ((match = cssRadius.exec(content)) !== null) {
    increment(radius, match[1]);
  }
}

function extractColors(content: string, colors: TokenFrequencies): void {
  // Tailwind color classes: bg-COLOR, text-COLOR, border-COLOR
  const twColor = /\b(?:bg|text|border|ring|outline|fill|stroke)-((?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = twColor.exec(content)) !== null) {
    increment(colors, match[1]);
  }

  // CSS hex colors
  const hexColor = /#([0-9a-fA-F]{3,8})\b/g;
  while ((match = hexColor.exec(content)) !== null) {
    increment(colors, "#" + match[1].toLowerCase());
  }
}

function extractShadows(content: string, shadows: TokenFrequencies): void {
  // Tailwind shadow classes
  const twShadow = /\bshadow(?:-(none|sm|md|lg|xl|2xl|inner))?\b/g;
  let match: RegExpExecArray | null;
  while ((match = twShadow.exec(content)) !== null) {
    increment(shadows, match[1] ?? "DEFAULT");
  }

  // CSS box-shadow (just detect presence)
  const cssShadow = /box-shadow\s*:/g;
  while ((match = cssShadow.exec(content)) !== null) {
    increment(shadows, "css-box-shadow");
  }
}

function extractTypography(content: string, typography: TokenFrequencies): void {
  // Tailwind text size classes
  const twTextSize = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g;
  let match: RegExpExecArray | null;
  while ((match = twTextSize.exec(content)) !== null) {
    increment(typography, "size:" + match[1]);
  }

  // Tailwind font weight classes
  const twFontWeight = /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g;
  while ((match = twFontWeight.exec(content)) !== null) {
    increment(typography, "weight:" + match[1]);
  }

  // Tailwind leading (line height) classes
  const twLeading = /\bleading-(none|tight|snug|normal|relaxed|loose|\d+)\b/g;
  while ((match = twLeading.exec(content)) !== null) {
    increment(typography, "leading:" + match[1]);
  }

  // Tailwind tracking (letter spacing) classes
  const twTracking = /\btracking-(tighter|tight|normal|wide|wider|widest)\b/g;
  while ((match = twTracking.exec(content)) !== null) {
    increment(typography, "tracking:" + match[1]);
  }

  // CSS font-size
  const cssFontSize = /font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/g;
  while ((match = cssFontSize.exec(content)) !== null) {
    increment(typography, "size:" + match[1]);
  }

  // CSS font-weight
  const cssFontWeight = /font-weight\s*:\s*(\d{3}|bold|normal|lighter|bolder)/g;
  while ((match = cssFontWeight.exec(content)) !== null) {
    increment(typography, "weight:" + match[1]);
  }
}

function sortByFrequency(map: TokenFrequencies): TokenFrequencies {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const result: TokenFrequencies = {};
  for (const [key, value] of entries) {
    result[key] = value;
  }
  return result;
}

function suggestBaseUnit(spacing: TokenFrequencies): number {
  // Find the GCD of the most common spacing values
  const numericValues = Object.keys(spacing)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n) && n > 0);

  if (numericValues.length === 0) return 4;

  // Check if most values are divisible by 4, 8, or 2
  const divisibleBy4 = numericValues.filter((v) => v % 4 === 0).length;
  const divisibleBy8 = numericValues.filter((v) => v % 8 === 0).length;

  if (divisibleBy8 / numericValues.length > 0.6) return 8;
  if (divisibleBy4 / numericValues.length > 0.5) return 4;
  return 4;
}

function determineDepthStrategy(shadows: TokenFrequencies): string {
  const shadowTotal = Object.entries(shadows)
    .filter(([k]) => k !== "none")
    .reduce((sum, [, v]) => sum + v, 0);
  const noneCount = shadows["none"] ?? 0;

  if (shadowTotal === 0 || noneCount > shadowTotal * 2) return "border-dominant";
  if (shadowTotal > noneCount * 2) return "shadow-dominant";
  return "mixed";
}

function main(): void {
  const targetDir = process.argv[2] ?? ".";

  // Try common UI paths if scanning root
  let dirs: string[];
  if (targetDir === ".") {
    const candidates = ["src", "app", "components", "pages", "lib", "."];
    dirs = candidates.filter((d) => {
      const result = spawnSync("test", ["-d", d]);
      return result.status === 0;
    });
    if (dirs.length === 0) dirs = ["."];
  } else {
    dirs = [targetDir];
  }

  const allFiles = new Set<string>();
  for (const dir of dirs) {
    for (const f of findFiles(dir)) {
      allFiles.add(f);
    }
  }

  const spacing: TokenFrequencies = {};
  const radius: TokenFrequencies = {};
  const colors: TokenFrequencies = {};
  const shadows: TokenFrequencies = {};
  const typography: TokenFrequencies = {};

  for (const file of allFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      extractSpacing(content, spacing);
      extractRadius(content, radius);
      extractColors(content, colors);
      extractShadows(content, shadows);
      extractTypography(content, typography);
    } catch {
      // Skip unreadable files
    }
  }

  const output: Output = {
    files_scanned: allFiles.size,
    spacing: sortByFrequency(spacing),
    radius: sortByFrequency(radius),
    colors: sortByFrequency(colors),
    shadows: sortByFrequency(shadows),
    typography: sortByFrequency(typography),
    suggested_base_unit: suggestBaseUnit(spacing),
    depth_strategy: determineDepthStrategy(shadows),
  };

  console.log(JSON.stringify(output));
}

main();
