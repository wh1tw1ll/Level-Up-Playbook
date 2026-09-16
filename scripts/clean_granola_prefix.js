const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();

const PROJECT_SHEET = '4456864287772548';
const PERSONAL_SHEET = '2802755367554948';

function ssheet(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.smartsheet.com/2.0' + path;
    const req = https.request(url, { method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get the project sheet to find the Action Item column
  const sheet = await ssheet('/sheets/' + PROJECT_SHEET);
  const actionCol = (sheet.columns || []).find(c => c.title === 'Action ID');
  if (!actionCol) { console.log('Action Item column not found'); return; }
  console.log('Action Item column ID:', actionCol.id);
  
  // Find rows with [Granola: prefix
  const rows = sheet.rows || [];
  const toFix = rows.filter(r => {
    const cell = (r.cells || []).find(c => c.columnId === actionCol.id);
    return cell && cell.value && typeof cell.value === 'string' && cell.value.startsWith('[Granola:');
  });
  
  console.log('Rows to fix:', toFix.length);
  
  // Process in batches of 50
  const batches = [];
  for (let i = 0; i < toFix.length; i += 50) {
    batches.push(toFix.slice(i, i + 50));
  }
  
  let fixed = 0;
  for (const batch of batches) {
    const updates = batch.map(r => {
      const cell = (r.cells || []).find(c => c.columnId === actionCol.id);
      let text = cell.value;
      // Remove [Granola: ...] prefix
      text = text.replace(/^\[Granola:[^\]]+\]\s*/, '');
      // Remove leading numbering like "1. " or "1.1 "
      text = text.replace(/^\d+(\.\d+)?\.\s*/, '');
      text = text.trim();
      
      return {
        id: r.id,
        cells: [{ columnId: actionCol.id, value: text }]
      };
    });
    
    const result = await ssheet('/sheets/' + PROJECT_SHEET + '/rows', 'PUT', updates);
    fixed += updates.length;
    console.log('Batch: ' + result.message + ' (' + fixed + '/' + toFix.length + ')');
  }
  
  console.log('\\nDone. Fixed ' + fixed + ' rows.');
}

main().catch(e => console.log('Error:', e.message));