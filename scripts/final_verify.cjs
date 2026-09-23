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
    
    const actions = s.rows.map(r => {
      const vals = {};
      (r.cells || []).forEach(c => {
        const col = s.columns.find(x => x.id === c.columnId);
        if (col) vals[col.title] = c.displayValue || c.value || '';
      });
      return String(vals['Action ID'] || '').trim();
    }).filter(Boolean);

    // Check kept
    const keptChecks = [
      'Greg to pursue Tim at McCarthy to settle dispute',
      'Report back to KozPure team on McCarthy dispute status',
      'Align with KozPure before releasing detailed DOVA schedule',
      'COA 87: to be removed from COAs',
      'Follow up with DCL on pending reduction and Procore invoicing',
      'Matt to send Charlie/Josh a map marking acceptable and unacceptable parking zones'
    ];

    console.log('=== KEPT ===');
    keptChecks.forEach(s => {
      const found = actions.some(a => a.includes(s.substring(0, 50)));
      console.log((found ? '✅' : '❌') + ' ' + s.substring(0, 70));
    });

    // Check deleted
    const delChecks = [
      'Greg trying to reach Tim at McCarthy to resolve',
      'Report back to KozPure team next week',
      'Coordinate with KozPure before releasing detailed schedule',
      'Remove COA 87 from COAs; address within project agreements DA or RPA',
      'One further reduction pending; Whitney to follow up with DCL',
      'Send parking zone map to Charlie and Josh'
    ];

    console.log('\n=== DELETED ===');
    delChecks.forEach(s => {
      const found = actions.some(a => a.includes(s.substring(0, 40)));
      console.log((found ? '❌ STILL THERE' : '✅ GONE') + ' ' + s.substring(0, 70));
    });

    console.log('\nTotal rows: ' + s.rows.length);
    console.log('Deleted total: ' + (300 - s.rows.length));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();