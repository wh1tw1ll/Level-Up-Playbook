const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('C:\\Users\\HermesAdmin\\Level-Up-Playbook\\.env.local', 'utf8');
const tokenLine = env.split('\n').find(l => l.startsWith('SMARTSHEET_TOKEN'));
const token = tokenLine.split('=')[1].trim().replace(/"/g, '');

function getSheetCols(sheetId, label) {
  return new Promise((resolve, reject) => {
    https.get(
      'https://api.smartsheet.com/2.0/sheets/' + sheetId + '?include=columns&level=1',
      { headers: { 'Authorization': 'Bearer ' + token } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          const d = JSON.parse(data);
          console.log('\n' + label + ' (' + sheetId + '):');
          (d.columns || []).forEach(col => {
            console.log('  ' + col.title + ' (' + col.type + ')' + (col.title.toLowerCase().includes('complete') || col.title.toLowerCase().includes('completed') ? ' <--' : ''));
          });
          resolve();
        });
      }
    ).on('error', reject);
  });
}

(async () => {
  await getSheetCols('4456864287772548', 'Project Sheet (DOVA)');
  await getSheetCols('2802755367554948', 'Personal Sheet');
})();