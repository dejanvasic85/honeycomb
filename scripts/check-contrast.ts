#!/usr/bin/env node
// Fails if any text/background token pair used in the app falls below WCAG AA
// (4.5:1 for normal text). See docs/SPEC.md §7: "Verify with a contrast
// checker in CI if you can be bothered."
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const tokensFile = join(root, "src", "styles", "tokens.css");
const tokensCss = readFileSync(tokensFile, "utf8");

function readToken(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Token --${name} not found in ${tokensFile}`);
  return match[1];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(fg: string, bg: string): number {
  const lFg = relativeLuminance(hexToRgb(fg));
  const lBg = relativeLuminance(hexToRgb(bg));
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

// Every foreground/background pair actually rendered as text in the app.
// Add a pair here whenever a component puts new text on a new token background.
const AA_NORMAL_TEXT = 4.5;
const pairs: { name: string; fg: string; bg: string; min: number }[] = [
  { name: "ink on paper (body text)", fg: "ink", bg: "paper", min: AA_NORMAL_TEXT },
  { name: "ink on paper-shade (player rows)", fg: "ink", bg: "paper-shade", min: AA_NORMAL_TEXT },
  {
    name: "ink-muted on paper (secondary text)",
    fg: "ink-muted",
    bg: "paper",
    min: AA_NORMAL_TEXT,
  },
  { name: "sting on paper (error text)", fg: "sting", bg: "paper", min: AA_NORMAL_TEXT },
  { name: "sting on paper-shade", fg: "sting", bg: "paper-shade", min: AA_NORMAL_TEXT },
  { name: "paper on sting (stung hex content)", fg: "paper", bg: "sting", min: AA_NORMAL_TEXT },
  { name: "ink on honey-1 (hex cell content)", fg: "ink", bg: "honey-1", min: AA_NORMAL_TEXT },
  { name: "ink on honey-2 (hex cell content)", fg: "ink", bg: "honey-2", min: AA_NORMAL_TEXT },
  { name: "ink on honey-3 (hex cell content)", fg: "ink", bg: "honey-3", min: AA_NORMAL_TEXT },
  { name: "ink on honey-4 (hex cell content)", fg: "ink", bg: "honey-4", min: AA_NORMAL_TEXT },
];

const failures: string[] = [];

for (const pair of pairs) {
  const ratio = contrastRatio(readToken(pair.fg), readToken(pair.bg));
  const status = ratio >= pair.min ? "PASS" : "FAIL";
  console.log(`${status}  ${pair.name}: ${ratio.toFixed(2)}:1 (min ${pair.min}:1)`);
  if (ratio < pair.min) failures.push(pair.name);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} pair(s) below WCAG AA:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

console.log("\nAll token pairs meet WCAG AA (4.5:1) for normal text.");
