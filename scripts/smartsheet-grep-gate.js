#!/usr/bin/env node
/**
 * smartsheet-grep-gate.js
 *
 * Scans all .js files under api/ for direct Smartsheet API calls
 * OUTSIDE the allowed write module (lib/guarded-write.js).
 *
 * Exit: 0 = pass, 1 = fail (blocks deploy)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// The ONLY files allowed to contain Smartsheet API calls
const ALLOWED = new Set([
  path.join('lib', 'guarded-write.js').replace(/\\/g, '/'),
  path.join('lib', 'smartsheet.js').replace(/\\/g, '/'),
]);

function isAllowed(relativePath) {
  for (const a of ALLOWED) {
    if (relativePath === a) return true;
  }
  return false;
}

// Patterns indicating a direct Smartsheet API call
const PATTERNS = [
  /api\.smartsheet\.com/,   // catches all smartsheet.com API URLs
  /smartsheet\.sheets/,     // catches SDK usage
  /['"`]Authorization['"`]\s*:.*smartsheet/i, // auth header
];

function scanFile(filePath) {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (isAllowed(relative)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    for (const pat of PATTERNS) {
      if (pat.test(lines[i])) {
        violations.push({ file: relative, line: i + 1, text: lines[i].trim().substring(0, 100) });
        break;
      }
    }
  }
  return violations;
}

function scanDir(dirPath, depth = 0) {
  if (depth > 5) return [];
  const violations = [];
  if (!fs.existsSync(dirPath)) return violations;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    const relative = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      // Skip excluded directories
      if (SKIP_DIRS.has(relative) || SKIP_DIRS.has(relative + '/')) continue;
      violations.push(...scanDir(fullPath, depth + 1));
    } else if (entry.name.endsWith('.js')) {
      violations.push(...scanFile(fullPath));
    }
  }
  return violations;
}

// Only scan dirs that are deployed, excluding lib/handlers/ (separate products)
const DIRS = [
  path.join(ROOT, 'api'),
  path.join(ROOT, 'lib'),
];

// Skip separate product directories under lib/
const SKIP_DIRS = new Set([
  path.join('lib', 'handlers').replace(/\\/g, '/'),
  path.join('lib', 'handlers').replace(/\\/g, '/') + '/',
]);

const violations = DIRS.flatMap(d => scanDir(d));

if (violations.length > 0) {
  console.error('\n=== SMARTSHEET GREP GATE: BLOCKED ===');
  const allowlistStr = Array.from(ALLOWED).join(', ');
  console.error(`Found ${violations.length} direct Smartsheet API call(s) outside ${allowlistStr}:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  console.error(`\nAll Smartsheet writes must go through ${ALLOWED}.`);
  console.error('Refactor the calls above or add them to the allowlist if they are read-only utilities.\n');
  process.exit(1);
} else {
  console.log('✓ Smartsheet grep gate: PASS — no direct API calls outside guarded-write.js');
  process.exit(0);
}