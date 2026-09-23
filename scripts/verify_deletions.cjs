const fs = require('fs');

// Read token from env file
function getToken() {
  const lines = fs.readFileSync('C:/Users/HermesAdmin/Level-Up-Playbook/.env.local', 'utf8').split('\n');
  for (const l of lines) {
    const t = l.trim();
    if (t.includes('SMARTSHEET_TOKEN') && t.includes('=')) {
      const eqIdx = t.indexOf('=');
      let val = t.substring(eqIdx + 1);
      val = val.replace(/"/g, '').replace(/'/g, '').trim();
      if (val.length > 10) return val;
    }
  }
  throw new Error('Token not found');
}

const token = getToken();
console.error('Token len:', token.length);

const https = require('https');
const opts = {
  hostname: 'api.smartsheet.com',
  path: '/2.0/sheets/4456864287772548',
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + token }
};

const req = https.request(opts, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);
    console.log(JSON.stringify({
      name: s.name,
      totalRows: s.rows.length,
      deletedRowsStillPresent: [7, 24, 53, 58, 65, 82, 109, 115].filter(rn => s.rows.some(r => r.rowNumber === rn)),
      keptRowsPresent: [1, 8, 13, 16, 36, 37, 41, 59].filter(rn => s.rows.some(r => r.rowNumber === rn))
    }));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();