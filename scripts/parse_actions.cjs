const fs = require('fs');
const s = JSON.parse(fs.readFileSync('/tmp/action_tracker.json', 'utf8'));

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

console.error('Actions column:', titleCol ? titleCol.title : 'NONE');
console.error('Status column:', statusCol ? statusCol.title : 'NONE');

// Print all action items
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

  const action = ai.substring(0, 200);
  if (action) {
    const rowNum = r.rowNumber;
    const status = st;
    const owner = ow.substring(0, 30);
    items.push({ rowNum, action, status, owner });
  }
});

// Output as JSON for analysis
console.log(JSON.stringify(items, null, 2));