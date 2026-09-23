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
    
    // Build items with their Smartsheet row IDs
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
        owner: String(vals['Owner'] || '').trim()
      };
    }).filter(i => i.action);

    // === DUPLICATE PAIRS (by action meaning, not wording) ===
    // Format: [deleteRowNum, keepRowNum, reason]
    const toDelete = [
      // Philip flagging agenda items - same task
      [193, 105, 'Philip flag agenda items for SD kickoff - same task'],
      // Matt marking parking zones - same task
      [167, 148, 'Mark acceptable/unacceptable parking zones - same task'],
      // David reviewing SoFi lawsuit email - same task
      [185, 145, 'David review SoFi lawsuit precedent email - same task'],
      // Message Orlana schedule P&W design session - same task
      [175, 104, 'Message Orlana schedule P&W design update session - same task'],
      // Email Charlie/Josh re schedule release to Jeremiah - same task
      [181, 90, 'Email Charlie/Josh about schedule release to Jeremiah - same task'],
      // Charlie call Arlene about Planning Commission - same task
      [282, 180, 'Charlie call Arlene for Planning Commission notice - same task'],
      // Charlie/Josh meet police about parking - same task
      [284, 146, 'Meet police dept to negotiate parking spaces - same task'],
      // Notify Whitney about SD kickoff additions - same task
      [154, 93, 'Notify Whitney of additions to SD kickoff run of show - same task'],
      // Charlie approve schedule to Jeremiah copy Matt/Philip - same task
      [171, 91, 'Charlie approve schedule detail to Jeremiah copy Matt/Philip - same task'],
      // JCI Budget Review / Review JCI $76K budget - same task
      [272, 131, 'JCI Budget Review - same task'],
      // Forward biologist materials to Whitney - same task
      [279, 31, 'Forward biologist materials/email to Whitney - same task'],
      // Greg pursuing Tim McCarthy $99K - same task
      [99, 39, 'Greg pursue Tim McCarthy settle $99K dispute - same task'],
      // Update schedule with COA revisions send to Philip - same task
      [106, 92, 'Update schedule with COA revisions send to Philip - same task']
    ];

    // Find the Smartsheet IDs
    const idsToDelete = [];
    const idMap = {};
    items.forEach(i => { idMap[i.rowNum] = i; });

    toDelete.forEach(([delRow, keepRow, reason]) => {
      const delItem = idMap[delRow];
      const keepItem = idMap[keepRow];
      if (delItem && keepItem) {
        idsToDelete.push(delItem.smartsheetId);
        console.log('DELETE Row ' + delRow + ' (id=' + delItem.smartsheetId + ') [' + delItem.status + ']: ' + delItem.action.substring(0, 80));
        console.log('  KEEP Row ' + keepRow + ' [' + keepItem.status + ']: ' + keepItem.action.substring(0, 80));
        console.log('  Reason: ' + reason);
        console.log('');
      } else {
        console.log('MISSING: Row ' + delRow + ' (' + !delItem + ') or Row ' + keepRow + ' (' + !keepItem + ')');
      }
    });

    console.log('\nTotal IDs to delete: ' + idsToDelete.length);
    console.log('CSV: ' + idsToDelete.join(','));

    // Now DELETE them
    if (idsToDelete.length > 0) {
      const ids = idsToDelete.join(',');
      const deleteOpts = {
        hostname: 'api.smartsheet.com',
        path: '/2.0/sheets/4456864287772548/rows?ids=' + ids,
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      };
      const deleteReq = https.request(deleteOpts, (res2) => {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => {
          const result = JSON.parse(d2);
          console.log('\nDelete Result: ' + (result.message || 'ERROR') + ' (' + (result.result || []).length + ' deleted)');
        });
      });
      deleteReq.on('error', e => console.error('Delete Error:', e.message));
      deleteReq.end();
    }
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();