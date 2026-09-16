const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const SHEET_ID = '1007659559112580';

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
  // 1. Get existing rows
  const sheet = await ssheet('/sheets/' + SHEET_ID);
  const rows = sheet.rows || [];
  console.log('Existing rows:', rows.length);
  
  // 2. Delete one by one (Smartsheet max URL length)
  for (const r of rows) {
    const result = await ssheet('/sheets/' + SHEET_ID + '/rows/' + r.id, 'DELETE');
    console.log('Deleted row ' + r.id + ': ' + (result.message || 'OK'));
  }
  
  // 3. Verify empty
  const verify = await ssheet('/sheets/' + SHEET_ID);
  console.log('\nRemaining rows:', (verify.rows || []).length);
}

main().catch(e => console.log('Error:', e.message));