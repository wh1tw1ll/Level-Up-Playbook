const fs = require('fs');
// Read .env.local
const envText = fs.readFileSync('.env.local', 'utf8');
const lines = envText.split('\n');
let token = '';
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('SMARTSHEET_TOKEN=')) {
    token = trimmed.split('=')[1].replace(/["']/g, '').trim();
    break;
  }
}

const SHEET_ID = '4975609129160580';
const url = `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}?include=attachments,comments`;

fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(data => {
  // Print columns
  console.log('=== COLUMNS ===');
  data.columns.forEach(c => console.log(`  [${c.index}] ${c.title} (id=${c.id})`));

  // Print all action items
  console.log(`\n=== ${data.rows.length} ROWS ===`);
  data.rows.forEach((row, i) => {
    const cells = row.cells || [];
    const values = cells.map(c => (c.displayValue || c.value || '').toString().substring(0,80));
    const rowNum = row.rowNumber;
    // Print row number + all cell values
    console.log(`\nROW ${rowNum}:`);
    console.log(`  ${values.join(' | ')}`);
    // Print comments/attachments length
    if (row.comments && row.comments.length) console.log(`  [${row.comments.length} comments]`);
    if (row.attachments && row.attachments.length) console.log(`  [${row.attachments.length} attachments]`);
  });
}).catch(e => console.error('Error:', e.message));