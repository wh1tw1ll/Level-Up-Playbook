const fs = require('fs');
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
if (!token || token.length < 10) {
  console.error('ERROR: Bad token length:', token.length, 'token:', JSON.stringify(token));
  process.exit(1);
}
console.error('Token OK (len=' + token.length + ')');

const SHEET_ID = '4975609129160580';
const url = `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}?include=attachments,comments`;

const https = require('https');
https.get(url, {
  headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    
    // Print columns
    console.error('=== COLUMNS ===');
    data.columns.forEach(c => console.error(`  [${c.index}] ${c.title}`));
    
    // Build column index by title
    const colIdx = {};
    data.columns.forEach(c => { colIdx[c.title] = c.index; });
    
    console.error('=== ' + data.rows.length + ' ROWS ===');
    
    // Extract action items text for dedup analysis
    const items = [];
    data.rows.forEach((row, i) => {
      const cells = row.cells || [];
      const vals = {};
      cells.forEach(c => { vals[c.columnId] = c.displayValue || c.value || ''; });
      
      const rowNum = row.rowNumber;
      const actionItem = vals[Object.keys(colIdx).find(k => k.toLowerCase().includes('action') || k.toLowerCase().includes('item'))] || '';
      const status = vals[Object.keys(colIdx).find(k => k.toLowerCase().includes('status'))] || '';
      const owner = vals[Object.keys(colIdx).find(k => k.toLowerCase().includes('owner') || k.toLowerCase().includes('assign'))] || '';
      
      items.push({ rowNum, actionItem: String(actionItem).trim(), status: String(status).trim(), owner: String(owner).trim() });
    });
    
    // Output just the action items text (JSON) for analysis
    console.log(JSON.stringify(items));
  });
});