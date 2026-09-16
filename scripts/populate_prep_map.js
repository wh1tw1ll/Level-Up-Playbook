const fs = require('fs');
const https = require('https');
const smToken = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const msalTokens = JSON.parse(fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\msal_tokens.json', 'utf8'));
const granolaToken = 'grn_Xt3QX2jolKxe3tEGXUeL4QiH_DQwZXXZvbetD39O12j2PevnIBvXFgH6UZMphuXM6sUrP';

const SHEET_ID = '1007659559112580';
const COLS = {
  SERIES_MASTER_ID: 4939925902102404,
  SERIES_TITLE: 2688126088417156,
  GRANOLA_NOTE_ID: 7191725715787652,
  GRANOLA_NOTE_TITLE: 1562226181574532,
  LAST_MATCHED_AT: 6065825808945028,
  NOTE_MEETING_DATE: 3814025995259780,
  NOTE_AGE_DAYS: 8317625622630276,
  HAS_EVER_HAD_NOTE: 999276228153220
};

function ssheet(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.smartsheet.com/2.0' + path;
    const req = https.request(url, { method, headers: { 'Authorization': 'Bearer ' + smToken, 'Content-Type': 'application/json' } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function refreshToken() {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: 'd43fa6d5-ac58-4c6a-a0a1-083a1573ab03',
      refresh_token: msalTokens.refresh_token,
      grant_type: 'refresh_token',
      scope: 'openid profile email offline_access Calendars.Read User.Read'
    });
    const req = https.request('https://login.microsoftonline.com/8222d14d-0869-42d3-8b7f-858c65b89c0e/oauth2/v2.0/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.write(body.toString());
    req.end();
  });
}

function graph(path, token) {
  return new Promise((resolve, reject) => {
    https.get('https://graph.microsoft.com/v1.0' + path, { headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function granolaDetail(id) {
  return new Promise((resolve, reject) => {
    https.get('https://public-api.granola.ai/v1/notes/' + id, { headers: { 'Authorization': 'Bearer ' + granolaToken } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
  });
}

function granolaList(cursor = null) {
  return new Promise((resolve, reject) => {
    const u = cursor ? 'https://public-api.granola.ai/v1/notes?page_size=30&cursor=' + encodeURIComponent(cursor)
                     : 'https://public-api.granola.ai/v1/notes?page_size=30';
    https.get(u, { headers: { 'Authorization': 'Bearer ' + granolaToken } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
  });
}

async function main() {
  // 1. Get fresh Graph token
  const r = await refreshToken();
  if (r.error) { console.log('Token refresh failed'); return; }
  const tok = r.access_token;
  console.log('Graph token obtained');

  // 2. Get upcoming events to find series masters
  const now = new Date().toISOString();
  const end = new Date(Date.now() + 14*86400000).toISOString();
  const upcoming = await graph('/me/calendarview?startDateTime=' + encodeURIComponent(now) + '&endDateTime=' + encodeURIComponent(end) + '&$select=subject,id,seriesMasterId&$top=50', tok);
  const events = upcoming.value || [];
  const seriesMasters = [...new Set(events.filter(e => e.seriesMasterId).map(e => e.seriesMasterId))];
  console.log('Series masters found:', seriesMasters.length);

  // 3. Get past instances for each series (Aug 1 - Sep 15)
  const seriesData = {};
  for (const sm of seriesMasters) {
    const inst = await graph('/me/calendar/events/' + encodeURIComponent(sm) + '/instances?startDateTime=2026-08-01T00:00:00Z&endDateTime=2026-09-15T23:59:00Z&$select=subject,start,id&$top=20', tok);
    seriesData[sm] = (inst.value || []).sort((a, b) => new Date(b.start?.dateTime) - new Date(a.start?.dateTime));
    console.log('  Series: past instances=' + (inst.value || []).length + ' | title=' + (inst.value?.[0]?.subject || events.find(e => e.seriesMasterId === sm)?.subject || '?'));
  }

  // 4. Get ALL Granola notes (paginated)
  let allNotes = [];
  let cursor = null;
  while (true) {
    const page = await granolaList(cursor);
    allNotes = allNotes.concat(page.notes || []);
    if (!page.hasMore) break;
    cursor = page.cursor;
    if (!cursor) break;
  }
  console.log('Total Granola notes:', allNotes.length);

  // 5. Get details for notes that might match (NHS6, DOVA, KozPure, 4D Wind, Boldyn, Dova Arena)
  const relevantIds = allNotes.filter(n => {
    const t = n.title || '';
    return t.includes('NHS6') || t.includes('DOVA') || t.includes('KozPure') || t.includes('Boldyn') || t.includes('Dova Arena') || t.includes('4D Wind') || t.includes('weekly touch') || t.includes('weekly update');
  }).map(n => n.id);

  console.log('Relevant notes to check:', relevantIds.length);

  // Fetch details for all relevant notes
  const noteDetails = {};
  for (const id of relevantIds) {
    const d = await granolaDetail(id);
    noteDetails[id] = d;
    console.log('  Detail: ' + (d.title || '').substring(0, 50) + ' | has_ce=' + (d.calendar_event?.calendar_event_id ? 'YES' : 'NO'));
  }

  // 6. For each series, find a matching note
  const nowDate = new Date();
  const seriesEntries = [];

  for (const sm of seriesMasters) {
    const past = seriesData[sm] || [];
    const event = events.find(e => e.seriesMasterId === sm);
    const title = event?.subject || 'Unknown';
    
    // Try to find matching note
    let matchedNote = null;
    let matchedInstanceDate = null;
    
    for (const inst of past) {
      const instId = inst.id;
      // Check all note details for a calendar_event_id match
      for (const [nid, nd] of Object.entries(noteDetails)) {
        if (nd.calendar_event?.calendar_event_id === instId) {
          matchedNote = nd;
          matchedInstanceDate = inst.start?.dateTime;
          break;
        }
      }
      if (matchedNote) break;
    }

    const meetingDate = matchedInstanceDate || null;
    const noteAgeDays = meetingDate ? Math.round((nowDate - new Date(meetingDate)) / 86400000) : null;
    const hasEverHadNote = matchedNote ? true : false;

    seriesEntries.push({
      seriesMasterId: sm,
      seriesTitle: title,
      granolaNoteId: matchedNote ? matchedNote.id : '',
      granolaNoteTitle: matchedNote ? matchedNote.title : '',
      lastMatchedAt: matchedNote ? nowDate.toISOString().slice(0, 10) : '',
      noteMeetingDate: meetingDate ? meetingDate.slice(0, 10) : '',
      noteAgeDays: noteAgeDays !== null ? noteAgeDays : '',
      hasEverHadNote
    });

    console.log('\nSeries: ' + title);
    console.log('  Past instances: ' + past.length);
    if (matchedNote) {
      console.log('  >>> MATCHED: ' + matchedNote.title + ' | meeting=' + meetingDate + ' | age=' + noteAgeDays + 'd');
    } else {
      console.log('  >>> NO NOTE for this series');
    }
  }

  // 7. Write to Smartsheet
  console.log('\n=== Writing to Smartsheet ===');

  // Clear existing
  const existing = await ssheet('/sheets/' + SHEET_ID);
  const existingIds = (existing.rows || []).map(r => r.id);
  if (existingIds.length > 0) {
    await ssheet('/sheets/' + SHEET_ID + '/rows?ids=' + existingIds.join(','), 'DELETE');
    console.log('Cleared ' + existingIds.length + ' existing rows');
  }

  // Add rows
  const rows = seriesEntries.map(s => ({
    toBottom: true,
    cells: [
      { columnId: COLS.SERIES_MASTER_ID, value: s.seriesMasterId },
      { columnId: COLS.SERIES_TITLE, value: s.seriesTitle },
      { columnId: COLS.GRANOLA_NOTE_ID, value: s.granolaNoteId },
      { columnId: COLS.GRANOLA_NOTE_TITLE, value: s.granolaNoteTitle },
      { columnId: COLS.LAST_MATCHED_AT, value: s.lastMatchedAt },
      { columnId: COLS.NOTE_MEETING_DATE, value: s.noteMeetingDate },
      { columnId: COLS.NOTE_AGE_DAYS, value: String(s.noteAgeDays) },
      { columnId: COLS.HAS_EVER_HAD_NOTE, value: s.hasEverHadNote }
    ]
  }));

  if (rows.length > 0) {
    const result = await ssheet('/sheets/' + SHEET_ID + '/rows', 'POST', { rows });
    console.log('Rows added:', result.message || JSON.stringify(result));
  }

  console.log('\nDONE. ' + seriesEntries.length + ' series mapped.');
  const withNotes = seriesEntries.filter(s => s.hasEverHadNote).length;
  console.log('With notes: ' + withNotes);
  console.log('Without notes: ' + (seriesEntries.length - withNotes));
}

main().catch(e => console.log('Error:', e.message));