const fs = require('fs');
// Check both paths
let raw;
try { raw = fs.readFileSync('/tmp/at.json', 'utf8'); }
catch(e) { raw = fs.readFileSync('C:/tmp/at.json', 'utf8'); }

const s = JSON.parse(raw);

if (s.errorCode) {
  console.error('API ERROR:', s.message, s.errorCode);
  process.exit(1);
}

console.error('Sheet:', s.name, '| Rows:', s.rows.length);

const cmap = {};
s.columns.forEach(c => { cmap[c.id] = c.title; });

// Find key columns
function findCol(regex) {
  return s.columns.filter(c => regex.test(c.title))[0];
}
const titleCol = findCol(/action|item|task|description/i);
const statusCol = findCol(/status/i);
const ownerCol = findCol(/owner|assign|responsible/i);
const dueCol = findCol(/due|date|deadline/i);
const priorityCol = findCol(/priority|p1|p2|urgency/i);
const categoryCol = findCol(/category|discipline|area|dept|phase/i);

console.error('Actions column:', titleCol ? titleCol.title + ' [idx=' + titleCol.index + ']' : 'NONE');
console.error('Status column:', statusCol ? statusCol.title + ' [idx=' + statusCol.index + ']' : 'NONE');
console.error('Owner column:', ownerCol ? ownerCol.title + ' [idx=' + ownerCol.index + ']' : 'NONE');
console.error('Category column:', categoryCol ? categoryCol.title + ' [idx=' + categoryCol.index + ']' : 'NONE');

// Print ALL columns
console.error('\n--- ALL COLUMNS ---');
s.columns.forEach(c => console.error('  [' + c.index + '] ' + c.title + ' (id=' + c.id + ')'));

// Print all rows with primary fields
const items = [];
s.rows.forEach(r => {
  const vals = {};
  (r.cells || []).forEach(c => {
    vals[c.columnId] = {
      val: String(c.displayValue || c.value || '').trim(),
      idx: c.columnIndex
    };
  });
  const ai = vals[titleCol?.id]?.val || '';
  const st = vals[statusCol?.id]?.val || '';
  const ow = vals[ownerCol?.id]?.val || '';
  const cat = vals[categoryCol?.id]?.val || '';
  const action = ai.substring(0, 300);
  if (action) {
    items.push({
      row: r.rowNumber,
      action,
      status: st.substring(0, 30),
      owner: ow.substring(0, 30),
      category: cat.substring(0, 30)
    });
  }
});

// Output as JSON for analysis
console.log(JSON.stringify(items, null, 2));