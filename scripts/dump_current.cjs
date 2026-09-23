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
    
    const items = s.rows.map(r => {
      const vals = {};
      (r.cells || []).forEach(c => {
        const col = s.columns.find(x => x.id === c.columnId);
        if (col) vals[col.title] = c.displayValue || c.value || '';
      });
      return {
        rowNum: r.rowNumber,
        smartsheetId: r.id,
        action: String(vals['Action ID'] || '').trim(),
        status: String(vals['Status'] || '').trim(),
        owner: String(vals['Owner'] || '').trim(),
        category: String(vals['Category'] || '').trim(),
        due: String(vals['Due Date'] || '').trim(),
        statusNote: String(vals['Status Note'] || '').trim()
      };
    }).filter(i => i.action);

    // Print ALL items with row numbers so I can find the pairs
    items.forEach(i => {
      const a = i.action.substring(0, 150);
      console.log(i.rowNum + '\t' + i.smartsheetId + '\t[' + i.status + ']\t' + i.owner + '\t' + a);
    });
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();