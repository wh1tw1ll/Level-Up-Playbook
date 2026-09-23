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

    // Build action texts
    const allTexts = s.rows.map(r => {
      const vals = {};
      (r.cells || []).forEach(c => {
        const col = s.columns.find(x => x.id === c.columnId);
        if (col) vals[col.title] = c.displayValue || c.value || '';
      });
      return String(vals['Action ID'] || '').trim();
    }).filter(Boolean);

    // Check kept texts still exist
    const keptChecks = [
      'Philip to flag any agenda items he wants covered',
      'Matt to send Charlie/Josh a map marking acceptable and unacceptable parking zone',
      'SoFi lawsuit precedent: economic components should not go into DA; David to rece',
      'Message Orlana to schedule P&W design update session',
      'Send email to Charlie and Josh regarding schedule release approach to Jeremiah a',
      'Charlie to call Arlene to confirm notice',
      'Charlie and Josh to meet with police department directly to negotiate down from',
      'Notify Whitney of any additions needed before he finalizes SD kickoff run of sho',
      'Get Charlie Tiwana approval before sending any further schedule detail to Jeremi',
      'JCI Budget Review - review Brian LaBrie budget table',
      'Charlie to forward all existing biologist materials to Whitney',
      'Greg to pursue Tim at McCarthy to settle dispute',
      'Update DOVA schedule to reflect latest COA revisions, then send to Philip for re'
    ];

    console.log('=== KEPT TEXT STILL EXISTS ===');
    keptChecks.forEach(search => {
      const found = allTexts.some(t => t.includes(search.substring(0, 50)));
      console.log((found ? '✅' : '❌') + ' ' + search.substring(0, 70));
    });

    // Check deleted texts are gone
    const deletedChecks = [
      'Philip to flag any agenda items for SD kickoff',
      'Mark acceptable and unacceptable parking locations to frame the COA 29',
      'David to review SoFi lawsuit precedent email',
      'Message Orlana to get on calendar for 2:00-5:00 PM MT',
      'Email Charlie and Josh re: schedule release to Jeremiah',
      'Call Arlene to obtain published notice and confirm Planning Commission agenda it',
      'Meet with police department to negotiate parking spaces below 21',
      'Let Whitney know anything to add before she finalizes the run of show',
      'Copy Matt and Philip; ask Charlie to approve before sending any further schedule',
      "Review JCI's revised $76K budget and report back",
      'Forward biologist email to Whitney',
      'Greg pursuing Tim at McCarthy; goal is to settle or find middle ground so $99,09',
      'Whitney to send Philip the updated schedule once COA revisions are incorporated'
    ];

    console.log('\n=== DELETED TEXT IS GONE ===');
    deletedChecks.forEach(search => {
      const found = allTexts.some(t => t.includes(search.substring(0, 40)));
      console.log((found ? '❌ STILL EXISTS' : '✅ GONE') + ' ' + search.substring(0, 70));
    });

    console.log('\nTotal rows: ' + s.rows.length + ' (started at 300)');
    console.log('Deleted: 21 total (8 + 13)');
    console.log('Remaining: ' + (300 - 21));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();