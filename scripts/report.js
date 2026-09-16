const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:\\Users\\HermesAdmin\\Level-Up-Playbook\\scripts\\calendar_full_report.json', 'utf8'));
const events = d.events;
const seriesData = d.seriesData;

// Granola notes with calendar_event_ids
const granolaNotes = {
  'not_qKk6oZ4sLF3PV2': { title: 'DOVA | Weekly Civil Touch-Base', ceid: 'AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3w7OdREAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADRcQE9AAAEA==', start: '2026-09-10T18:00:00Z' },
  'not_EFEU1ZY5XDaFph': { title: '4D Wind Effect & Lift Coordination', ceid: 'AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xHzHrgAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW1gAAEA==', start: '2026-09-14T18:00:00Z' },
  'not_XFxVKiCz4DbJBb': { title: 'FW: NHS6 - Weekly M, E, P, LV, AV Coordination', ceid: 'AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0gAAEA==', start: '2026-09-15T17:00:00Z' },
  'not_s0IFaCJf6prfnn': { title: 'NHS6 - Weekly Enclosure Coordination', ceid: 'AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0wAAEA==', start: '2026-09-15T15:30:00Z' },
  'not_hs5vTYIvIQzzVn': { title: 'Zoom - Level Up | KozPure re: McCarthy (30-mins)', ceid: 'AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANKuiZ_AAA=', start: '2026-09-09T00:00:00Z' },
};

console.log('=== UPCOMING EVENTS (next 14 days from ' + new Date().toISOString().slice(0,10) + ') ===\n');

events.forEach((e, i) => {
  const startLocal = new Date(e.start?.dateTime || e.start?.date);
  const startStr = startLocal.toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/New_York' });

  console.log('[' + (i+1) + '] ' + e.subject);
  console.log('    When: ' + startStr);
  console.log('    Loc: ' + (e.location?.displayName || ''));

  if (e.seriesMasterId) {
    console.log('    Recurring: YES');
    console.log('    seriesMasterId: ' + e.seriesMasterId.slice(-50));

    const past = seriesData[e.seriesMasterId] || [];
    if (past.length > 0) {
      const latest = past[0];
      const pastStart = new Date(latest.start?.dateTime);
      const pastStr = pastStart.toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/New_York' });
      console.log('    Previous instance: ' + pastStr);
      console.log('    Past eventId suffix: ' + (latest.id || '').slice(-40));

      // Match against Granola notes
      let matched = false;
      Object.entries(granolaNotes).forEach(([nid, gn]) => {
        if (gn.ceid === latest.id) {
          console.log('    RESOLUTION: L1 (EXACT) — Granola note "' + gn.title + '" (' + nid + ')');
          matched = true;
        }
      });
      if (!matched) {
        console.log('    RESOLUTION: L0 — No Granola note matched (past instance eventId not in any known note)');
      }
    } else {
      console.log('    RESOLUTION: L0.5 — No past instances in Sep 1-15 range');
    }
  } else {
    console.log('    Recurring: NO (singleInstance/one-off)');
    console.log('    RESOLUTION: ONE-OFF — No note expected');
  }
  console.log('');
});

const seriesMasters = [...new Set(events.filter(e => e.seriesMasterId).map(e => e.seriesMasterId))];
let matched = 0;
let unmatched = 0;
seriesMasters.forEach(sm => {
  const past = seriesData[sm] || [];
  if (past.length > 0) {
    const latest = past[0];
    const found = Object.values(granolaNotes).some(gn => gn.ceid === latest.id);
    if (found) matched++; else unmatched++;
  } else {
    unmatched++;
  }
});

console.log('=== SUMMARY ===');
console.log('Total upcoming events: ' + events.length);
console.log('One-off (no note expected): ' + events.filter(e => !e.seriesMasterId).length);
console.log('Recurring instances: ' + events.filter(e => e.seriesMasterId).length);
console.log('Unique recurring series: ' + seriesMasters.length);
console.log('Resolved at L1 (exact eventId match): ' + matched);
console.log('Unresolved (no Granola note for series): ' + unmatched);

const unresolvedNames = [];
seriesMasters.forEach(sm => {
  const past = seriesData[sm] || [];
  if (past.length === 0) { unresolvedNames.push('no past instances'); return; }
  const latest = past[0];
  const found = Object.values(granolaNotes).some(gn => gn.ceid === latest.id);
  if (!found) unresolvedNames.push(latest.subject);
});

console.log('\nUnresolved series:');
unresolvedNames.forEach(n => console.log('  - ' + n));