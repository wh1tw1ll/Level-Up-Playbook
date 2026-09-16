const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const SHEET_ID = '1007659559112580';

function ssheet(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.smartsheet.com/2.0' + path;
    const req = https.request(url, { method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { 
        const parsed = JSON.parse(d);
        if (res.statusCode >= 400) { console.log('ERROR ' + res.statusCode + ': ' + (parsed.message || d.slice(0,500))); }
        resolve(parsed); 
      });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Test writing a simple row
  const rowPayload = {
    rows: [{
      toBottom: true,
      cells: [
        { columnId: 4939925902102404, value: 'test_series_id_123' },
        { columnId: 2688126088417156, value: 'Test Title' },
        { columnId: 7191725715787652, value: 'note_123' }
      ]
    }]
  };

  console.log('Writing test row...');
  const result = await ssheet('/sheets/' + SHEET_ID + '/rows', 'POST', rowPayload);
  console.log('Result:', JSON.stringify(result, null, 2));
  
  // Check sheet
  const sheet = await ssheet('/sheets/' + SHEET_ID);
  console.log('\nSheet rows:', sheet.rows?.length || 0);
  if (sheet.rows && sheet.rows[0]) {
    console.log('First row cells:', JSON.stringify(sheet.rows[0].cells, null, 2));
  }
}

main().catch(e => console.log('Error:', e.message));