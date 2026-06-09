const acorn = require('acorn');
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf-8');
try {
  acorn.parse(src, {ecmaVersion: 2020, sourceType: 'script'});
  console.log('OK');
} catch(e) {
  console.log('ERROR:', e.message, 'line', e.loc && e.loc.line);
}