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
        due: String(vals['Due Date'] || '').trim()
      };
    }).filter(i => i.action);

    // Manual intent-based scan
    const toDelete = [];

    // PAIR 1: Greg reaching Tim at McCarthy vs Greg pursuing Tim at McCarthy
    // Row 173: "Greg trying to reach Tim at McCarthy to resolve" (Not Started, Greg)
    // Row 39: "Greg to pursue Tim at McCarthy to settle dispute | goal: release $99,090 P&W payment" (Complete) (KEPT)
    const r173 = items.find(i => i.rowNum === 173 && i.action.includes('Greg trying to reach Tim'));
    const r39 = items.find(i => i.rowNum === 39);
    if (r173 && r39) {
      toDelete.push({ del: r173, keep: r39, reason: 'Greg reaching Tim at McCarthy — same as Greg pursue Tim $99K dispute (Row 39 kept)' });
    }

    // PAIR 2: Report back to KozPure team
    // Row 24: "Report back to KozPure team on McCarthy dispute status and SD payment path by end of week" (Not Started, Greg, Whitney)
    // Row 179: "Report back to KozPure team next week" (Not Started, Greg, Whitney)
    const r24 = items.find(i => i.rowNum === 24 && i.action.includes('Report back to KozPure'));
    const r179 = items.find(i => i.rowNum === 179 && i.action.includes('Report back to KozPure'));
    if (r24 && r179) {
      toDelete.push({ del: r179, keep: r24, reason: 'Report back to KozPure team — same action, Row 24 has more detail' });
    }

    // PAIR 3: Coordinate/Align with KozPure before releasing schedule to Jeremiah
    // Row 88: "Align with KozPure before releasing detailed DOVA schedule to Jeremiah Zillig (City CBO)" (Complete)
    // Row 152: "Coordinate with KozPure before releasing detailed schedule to Jeremiah; Whitney to send Charlie/Josh a note..." (Not Started)
    const r88 = items.find(i => i.rowNum === 88 && i.action.includes('Align with KozPure before releasing'));
    const r152 = items.find(i => i.rowNum === 152 && i.action.includes('Coordinate with KozPure before releasing'));
    if (r88 && r152) {
      toDelete.push({ del: r152, keep: r88, reason: 'Get KozPure approval before releasing schedule to City — same task, R88 complete already' });
    }

    // PAIR 4: Remove COA 87 — addressed in DA/RPA
    // Row 163: "COA 87: to be removed from COAs; addressed within the suite of project agreements (DA or RPA)" (Complete)
    // Row 188: "Remove COA 87 from COAs; address within project agreements DA or RPA" (Complete)
    const r163 = items.find(i => i.rowNum === 163 && i.action.includes('COA 87'));
    const r188 = items.find(i => i.rowNum === 188 && i.action.includes('COA 87'));
    if (r163 && r188) {
      toDelete.push({ del: r188, keep: r163, reason: 'COA 87 removal/address in DA/RPA — same action' });
    }

    // PAIR 5: DCL follow-up (one already marked as merged)
    // Row 196: "One further reduction pending; Whitney to follow up with DCL" (Complete)
    // Row 197: "Follow up with DCL on pending reduction and Procore invoicing" (Not Started, Whitney)
    const r196 = items.find(i => i.rowNum === 196 && i.action.includes('follow up with DCL'));
    const r197 = items.find(i => i.rowNum === 197 && i.action.includes('DCL'));
    if (r196 && r197) {
      toDelete.push({ del: r196, keep: r197, reason: 'DCL follow-up — Row 197 broader (includes Procore invoicing)' });
    }

    // Print findings
    if (toDelete.length === 0) {
      console.log('No additional duplicates found in intent scan.');
      return;
    }

    console.log('=== INTENT SCAN: ADDITIONAL DUPLICATES ===\n');
    toDelete.forEach(d => {
      console.log('DELETE Row ' + d.del.rowNum + ' (id=' + d.del.smartsheetId + ') [' + d.del.status + ']: ' + d.del.action.substring(0, 80));
      console.log('  KEEP Row ' + d.keep.rowNum + ' [' + d.keep.status + ']: ' + d.keep.action.substring(0, 80));
      console.log('  Reason: ' + d.reason);
      console.log('');
    });

    // Execute deletions
    const idsToDelete = toDelete.map(d => d.del.smartsheetId).filter(Boolean);
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