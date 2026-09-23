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
        statusNote: String(vals['Status Note'] || '').trim()
      };
    }).filter(i => i.action);

    // Search by text content (not row numbers)
    const toDelete = [];

    // PAIR 1: Greg reaching/pursuing Tim at McCarthy
    const gregMcCarthyItems = items.filter(i => 
      i.action.toLowerCase().includes('greg') && 
      (i.action.toLowerCase().includes('mccarthy') || i.action.toLowerCase().includes('tim')) &&
      (i.action.toLowerCase().includes('reach') || i.action.toLowerCase().includes('pursu') || i.action.toLowerCase().includes('settle'))
    );
    if (gregMcCarthyItems.length >= 2) {
      // Keep the one with rowNum closest to 39 (original kept), delete others
      const sorted = gregMcCarthyItems.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0]; // older
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Greg reaching Tim at McCarthy — duplicate of ' + keep.action.substring(0, 60) });
      });
    }

    // PAIR 2: Report back to KozPure team
    const reportKozPure = items.filter(i => 
      i.action.toLowerCase().includes('report back') && 
      i.action.toLowerCase().includes('kozpure')
    );
    if (reportKozPure.length >= 2) {
      const sorted = reportKozPure.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Report back to KozPure team — same action' });
      });
    }

    // PAIR 3: Coordinate/Align with KozPure before releasing schedule
    const alignKozPureSchedule = items.filter(i => {
      const a = i.action.toLowerCase();
      return (a.includes('align') || a.includes('coordinate')) && 
             a.includes('kozpure') && 
             a.includes('releas') && 
             a.includes('jeremiah');
    });
    if (alignKozPureSchedule.length >= 2) {
      const sorted = alignKozPureSchedule.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Get KozPure approval before releasing schedule to City — same action' });
      });
    }

    // PAIR 4: COA 87 removal
    const coa87 = items.filter(i => {
      const a = i.action.toLowerCase();
      return a.includes('coa 87') || a.includes('coa87');
    });
    if (coa87.length >= 2) {
      const sorted = coa87.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'COA 87 removal/DA RPA — same action' });
      });
    }

    // PAIR 5: DCL follow-up
    const dcl = items.filter(i => {
      const a = i.action.toLowerCase();
      return a.includes('dcl') && (a.includes('reduction') || a.includes('follow'));
    });
    if (dcl.length >= 2) {
      const sorted = dcl.sort((a, b) => a.rowNum - b.rowNum);
      // Keep the Not Started one (broader scope), delete Complete one
      const keep = sorted.find(i => i.status === 'Not Started') || sorted[0];
      sorted.filter(i => i !== keep).forEach(del => {
        toDelete.push({ del, keep, reason: 'DCL follow-up — merged/duplicate' });
      });
    }

    // PAIR 6: Philip flag agenda items
    const philipFlag = items.filter(i => {
      const a = i.action.toLowerCase();
      return a.includes('philip') && a.includes('flag') && a.includes('agenda');
    });
    if (philipFlag.length >= 2) {
      const sorted = philipFlag.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Philip flag agenda items — same task' });
      });
    }

    // PAIR 7: Matt parking zones
    const parkingZones = items.filter(i => {
      const a = i.action.toLowerCase();
      return a.includes('parking') && (a.includes('acceptable') || a.includes('unacceptable') || a.includes('zone'));
    });
    if (parkingZones.length >= 2) {
      const sorted = parkingZones.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Parking zone map — same task' });
      });
    }

    // PAIR 8: Charlie call Arlene
    const charlieArlene = items.filter(i => {
      const a = i.action.toLowerCase();
      return a.includes('charlie') && a.includes('arlene');
    });
    if (charlieArlene.length >= 2) {
      const sorted = charlieArlene.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Charlie call Arlene — same task' });
      });
    }

    // PAIR 9: Police parking negotiation
    const policeParking = items.filter(i => {
      const a = i.action.toLowerCase();
      return (a.includes('police') || a.includes('police department')) && a.includes('parking');
    });
    if (policeParking.length >= 2) {
      const sorted = policeParking.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Police parking negotiation — same task' });
      });
    }

    // PAIR 10: Notify Whitney SD kickoff
    const notifyWhitney = items.filter(i => {
      const a = i.action.toLowerCase();
      return (a.includes('notify') || a.includes('let whitney')) && 
             a.includes('show') && 
             (a.includes('sam') || a.includes('additions'));
    });
    if (notifyWhitney.length >= 2) {
      const sorted = notifyWhitney.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Notify Whitney about SD kickoff run of show — same task' });
      });
    }

    // PAIR 11: Charlie approve schedule + copy Matt/Philip
    const charlieApprove = items.filter(i => {
      const a = i.action.toLowerCase();
      return (a.includes('charlie') || a.includes('tiwana')) && 
             a.includes('approve') && 
             a.includes('jeremiah') &&
             (a.includes('matt') || a.includes('philip'));
    });
    if (charlieApprove.length >= 2) {
      const sorted = charlieApprove.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Charlie approve schedule to Jeremiah copy Matt/Philip — same task' });
      });
    }

    // PAIR 12: JCI Budget Review
    const jciBudget = items.filter(i => {
      const a = i.action.toLowerCase();
      return (a.includes('jci') && (a.includes('budget') || a.includes('$76k') || a.includes('brian labrie')));
    });
    if (jciBudget.length >= 2) {
      const sorted = jciBudget.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'JCI budget review — same task' });
      });
    }

    // PAIR 13: Biologist materials
    const biologist = items.filter(i => {
      const a = i.action.toLowerCase();
      return a.includes('biologist');
    });
    if (biologist.length >= 2) {
      const sorted = biologist.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Biologist materials to Whitney — same task' });
      });
    }

    // PAIR 14: Update schedule with COA revisions send to Philip
    const updateSchedule = items.filter(i => {
      const a = i.action.toLowerCase();
      return (a.includes('update') || a.includes('send')) && 
             a.includes('schedule') && 
             a.includes('coa') && 
             a.includes('philip');
    });
    if (updateSchedule.length >= 2) {
      const sorted = updateSchedule.sort((a, b) => a.rowNum - b.rowNum);
      const keep = sorted[0];
      sorted.slice(1).forEach(del => {
        toDelete.push({ del, keep, reason: 'Update schedule with COA revisions send to Philip — same task' });
      });
    }

    // Deduplicate the delete list (same row might match multiple patterns)
    const uniqueDeletes = [];
    const seen = new Set();
    toDelete.forEach(d => {
      if (!seen.has(d.del.smartsheetId)) {
        seen.add(d.del.smartsheetId);
        uniqueDeletes.push(d);
      }
    });

    // Print results
    if (uniqueDeletes.length === 0) {
      console.log('No remaining duplicates found.');
      return;
    }

    console.log('=== REMAINING DUPLICATES FOUND ===\n');
    uniqueDeletes.forEach(d => {
      console.log('DELETE Row ' + d.del.rowNum + ' (id=' + d.del.smartsheetId + ') [' + d.del.status + ']: ' + d.del.action.substring(0, 90));
      console.log('  KEEP Row ' + d.keep.rowNum + ' [' + d.keep.status + ']: ' + d.keep.action.substring(0, 90));
      console.log('  ' + d.reason);
      console.log('');
    });

    // Execute delete
    const idsToDelete = uniqueDeletes.map(d => d.del.smartsheetId).filter(Boolean);
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