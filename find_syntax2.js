const fs = require('fs');
const acorn = require('acorn');
const src = fs.readFileSync('app.js', 'utf8');
const lines = src.split(/\r?\n/);

// Check each line for zero-width characters or other invisible chars
const suspicious = [];
for (let i = 0; i < src.length; i++) {
  const code = src.charCodeAt(i);
  // Zero-width: 0x200B, 0x200C, 0x200D, 0xFEFF, etc.
  // Non-breaking space: 0x00A0
  // Soft hyphen: 0x00AD
  if ([0x200B, 0x200C, 0x200D, 0xFEFF, 0x00A0, 0x00AD, 0x180E, 0x2060].includes(code)) {
    const lineNum = src.substring(0, i).split(/\r?\n/).length;
    const context = src.substring(Math.max(0,i-10), i+10);
    suspicious.push({pos: i, code, hex: code.toString(16), line: lineNum, context: JSON.stringify(context)});
  }
}
console.log('Suspicious chars:', suspicious.length);
suspicious.forEach(s => console.log('  line', s.line, ':', s.hex, '-', s.context));

// Also try to narrow down the actual acorn error by removing chunks
for (let pct = 0.99; pct > 0; pct -= 0.05) {
  const sliceEnd = Math.floor(src.length * pct);
  const sliced = src.slice(0, sliceEnd);
  try {
    acorn.parse(sliced, {ecmaVersion: 2020});
    console.log('Parsed ok at', (pct*100).toFixed(0)+'%');
    break;
  } catch(e) {
    // still error
  }
}
