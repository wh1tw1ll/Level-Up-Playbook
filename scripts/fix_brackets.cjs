const fs = require('fs');

function getToken() {
  const lines = fs.readFileSync('C:/Users/HermesAdmin/Level-Up-Playbook/.env.local', 'utf8').split('\n');
  for (const x of lines) {
    const t = x.trim();
    if (t.includes('SMARTSHEET_TOKEN') && t.includes('=')) {
      let v = t.split('=').slice(1).join('=');
      v = v.replace(/"/g, '').replace(/'/g, '').trim();
      if (v.length > 10) return v;
    }
  }
  throw new Error('Token not found');
}

const token = getToken();
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
    
    // Find Action ID column
    const actionCol = s.columns.find(c => c.title === 'Action ID');
    if (!actionCol) { console.log('Action ID column not found'); return; }

    // Find rows with bracket prefix
    const fixable = [];
    s.rows.forEach(r => {
      const actionCell = (r.cells || []).find(c => c.columnId === actionCol.id);
      if (actionCell) {
        const val = actionCell.displayValue || actionCell.value || '';
        const strVal = String(val);
        // Check for bracket prefix patterns
        if (strVal.startsWith('] ') || strVal.startsWith(']')) {
          const cleaned = strVal.replace(/^\s*\]\s*/, '');
          fixable.push({
            rowNum: r.rowNumber,
            rowId: r.id,
            cellId: actionCell.id,
            original: strVal.substring(0, 100),
            cleaned: cleaned.substring(0, 100)
          });
        }
      }
    });

    if (fixable.length === 0) {
      console.log('No bracket-prefix items found.');
      return;
    }

    console.log('Found ' + fixable.length + ' rows with bracket prefix:\n');
    fixable.forEach(f => {
      console.log('Row ' + f.rowNum + ' (id=' + f.rowId + '):');
      console.log('  BEFORE: "' + f.original + '"');
      console.log('  AFTER:  "' + f.cleaned + '"');
      console.log('');
    });

    // Now fix them via Smartsheet API
    // We need to PUT the cell value
    console.log('Fixing...');

    function fixNext(index) {
      if (index >= fixable.length) {
        console.log('\nDone. Fixed ' + fixable.length + ' rows.');
        return;
      }
      const f = fixable[index];
      const body = JSON.stringify({
        cells: [{ columnId: actionCol.id, value: f.cleaned }]
      });

      const putOpts = {
        hostname: 'api.smartsheet.com',
        path: '/2.0/sheets/4456864287772548/rows/' + f.rowId,
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const putReq = https.request(putOpts, (res2) => {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => {
          const result = JSON.parse(d2);
          if (result.message === 'SUCCESS') {
            console.log('  ✅ Row ' + f.rowNum + ' fixed');
          } else {
            console.log('  ❌ Row ' + f.rowNum + ': ' + (result.message || 'error'));
          }
          fixNext(index + 1);
        });
      });
      putReq.on('error', e => { console.error('Error:', e.message); fixNext(index + 1); });
      putReq.write(body);
      putReq.end();
    }

    fixNext(0);
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();