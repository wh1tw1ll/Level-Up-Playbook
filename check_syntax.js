var fs = require('fs');
var src = fs.readFileSync('app.js', 'utf8');

var opens = { '{': 0, '[': 0, '(': 0 };
var closes = { '}': 0, ']': 0, ')': 0 };
var inString = null;
var inRegex = false;

for (var i = 0; i < src.length; i++) {
  var ch = src[i];
  var prev = src[i - 1] || '';

  if (inString) {
    if (ch === inString && prev !== '\\') inString = null;
    continue;
  }
  if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
  if (ch === '/' && prev && '([,:;!&|?<>+=-*/% '.includes(prev) && !inRegex) { inRegex = true; continue; }
  if (ch === '/' && inRegex) { inRegex = false; continue; }
  if (inRegex) continue;

  if (ch in opens) opens[ch]++;
  if (ch in closes) closes[ch]++;
}

console.log('Opens:', JSON.stringify(opens));
console.log('Closes:', JSON.stringify(closes));
console.log('Diff {:', opens['{'] - closes['}']);
console.log('Diff [:', opens['['] - closes[']']);
console.log('Diff (:', opens['('] - closes[')']);