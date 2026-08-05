#!/usr/bin/env node
// Fails if any raw hex colour literal appears in a CSS file other than
// src/styles/tokens.css. See docs/SPEC.md §7: "Token discipline is the rule
// that matters."
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const srcDir = join(root, "src");
const tokensFile = join(srcDir, "styles", "tokens.css");
const hexPattern = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;

function collectCssFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectCssFiles(fullPath));
    } else if (entry.endsWith(".css")) {
      files.push(fullPath);
    }
  }
  return files;
}

const violations = [];

for (const file of collectCssFiles(srcDir)) {
  if (file === tokensFile) continue;
  const content = readFileSync(file, "utf8");
  const matches = content.match(hexPattern);
  if (matches) {
    violations.push({ file: relative(root, file), matches });
  }
}

if (violations.length > 0) {
  console.error("Raw hex values found outside tokens.css:\n");
  for (const { file, matches } of violations) {
    console.error(`  ${file}: ${matches.join(", ")}`);
  }
  console.error("\nReference a token from src/styles/tokens.css instead.");
  process.exit(1);
}

console.log("No raw hex values outside tokens.css.");
