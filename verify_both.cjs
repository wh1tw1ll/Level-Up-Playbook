const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('C:\\Users\\HermesAdmin\\Level-Up-Playbook\\.env.local', 'utf8');
const tokenLine = env.split('\n').find(l => l.startsWith('SMARTSHEET_TOKEN'));
const TOKEN = tokenLine.split('=')[1].trim().replace(/"/g, '');

function check(sheetId, label) {
  return new Promise((resolve) => {
    https.get('https://api.smartsheet.com/2.0/sheets/' + sheetId + '?include=columns&level=1',
      { headers: { 'Authorization': 'Bearer ' + TOKEN } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          const d = JSON.parse(data);
          const cols = {};
          for (const c of (d.columns || [])) cols[c.title] = c;
          const ddCol = cols['Due Date'];
          const cdCol = cols['Completed Date'];
          const rows = d.rows || [];
          
          let withDD = 0, withoutDD = 0;
          let withCD = 0, withoutCD = 0;
          let complete = 0;
          
          for (const row of rows) {
            const ddCell = (row.cells || []).find(c => c.columnId === ddCol?.id);
            const cdCell = (row.cells || []).find(c => c.columnId === cdCol?.id);
            if (ddCell && ddCell.value) withDD++; else withoutDD++;
            if (cdCell && cdCell.value) withCD++; else withoutCD++;
            const sCol = cols['Status'];
            const sCell = sCol ? (row.cells || []).find(c => c.columnId === sCol.id) : null;
            if (sCell && (sCell.value === 'Complete' || sCell.displayValue === 'Complete')) complete++;
          }
          
          console.log(label + ' (' + rows.length + ' rows):');
          console.log('  Due Date set: ' + withDD + ' | missing: ' + withoutDD);
          console.log('  Completed Date set: ' + withCD + ' | missing: ' + withoutCD);
          console.log('  Complete tasks: ' + complete);
          resolve();
        });
      }
    );
  });
}

(async () => {
  await check('4456864287772548', 'DOVA Project Sheet');
  await check('2802755367554948', 'Personal Sheet');
})();