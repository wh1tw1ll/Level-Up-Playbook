const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('C:\\Users\\HermesAdmin\\Level-Up-Playbook\\.env.local', 'utf8');
const tokenLine = env.split('\n').find(l => l.startsWith('SMARTSHEET_TOKEN'));
const token = tokenLine.split('=')[1].trim().replace(/"/g, '');

const TOKEN = token;
const DOVA_SHEET = '4456864287772548';
const PERSONAL_SHEET = '2802755367554948';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.smartsheet.com',
      path: '/2.0' + path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ error: e.message, raw: data.substring(0,200) }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  for (const [sheetId, label] of [[DOVA_SHEET, 'DOVA'], [PERSONAL_SHEET, 'Personal']]) {
    // Check if column exists
    const sheet = await api('GET', '/sheets/' + sheetId + '?include=columns&level=1');
    const hasCol = (sheet.columns || []).find(c => c.title === 'Completed Date');
    if (hasCol) {
      console.log(label + ': Completed Date column already exists (id: ' + hasCol.id + ')');
    } else {
      // Add column at index 0 (first)
      const result = await api('POST', '/sheets/' + sheetId + '/columns', {
        title: 'Completed Date',
        type: 'DATE',
        index: 0
      });
      if (result.message && result.message.includes('SUCCESS')) {
        console.log(label + ': Created Completed Date column, id=' + result.result.id);
      } else if (result.result && result.result.id) {
        console.log(label + ': Created Completed Date column, id=' + result.result.id);
      } else {
        console.log(label + ': Create result:', JSON.stringify(result).substring(0,200));
      }
    }
  }
}

main().catch(e => console.log('Error:', e));