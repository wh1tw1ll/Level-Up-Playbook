const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const SHEET_ID = '1007659559112580';

function ssheet(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.smartsheet.com/2.0' + path;
    const req = https.request(url, { 
      method, 
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } 
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { 
        try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
      });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Write minimal row
  const r1 = await ssheet('/sheets/' + SHEET_ID + '/rows', 'POST', {
    rows: [{
      toBottom: true,
      cells: [
        { columnId: 4939925902102404, value: 'SERIES_123' },
        { columnId: 2688126088417156, value: 'My Test Series' }
      ]
    }]
  });
  console.log('POST result:', r1.message, 'rowId:', r1.result?.id);

  // Now GET the sheet and check values
  const sheet = await ssheet('/sheets/' + SHEET_ID);
  console.log('\nAll rows from GET:');
  sheet.rows.forEach(r => {
    const c1 = r.cells?.find(c => c.columnId === 4939925902102404);
    const c2 = r.cells?.find(c => c.columnId === 2688126088417156);
    console.log('Row ' + r.rowNumber + ': col4939925902102404=' + JSON.stringify(c1?.value) + ' col2688126088417156=' + JSON.stringify(c2?.value));
    console.log('  cell.displayValue:', JSON.stringify(c1?.displayValue));
  });
}

main().catch(e => console.log('Error:', e.message));