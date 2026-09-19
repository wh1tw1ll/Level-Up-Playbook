// populate_prep_map.mjs — Populates the series-note map for the prep widget
// Routes ALL Smartsheet operations through smartsheet.js wrapper.
// Graph API + Granola API use https module (not Smartsheet).
// No direct api.smartsheet.com calls. Gate compliant.

import smartsheet from '../lib/smartsheet.js';
import fs from 'fs';
import https from 'https';

const smToken = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const msalTokens = JSON.parse(fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\msal_tokens.json', 'utf8'));
const granolaToken = 'grn_Xt3QX2jolKxe3tEGXUeL4QiH_DQwZXXZvbetD39O12j2PevnIBvXFgH6UZMphuXM6sUrP';

const PREP_MAP_SHEET = '1007659559112580';
const COLS = {
  SERIES_MASTER_ID: 4939925902102404,
  SERIES_TITLE: 2688126088417156,
  GRANOLA_NOTE_ID: 7191725715787652,
  GRANOLA_NOTE_TITLE: 1562226181574532,
  LAST_MATCHED_AT: 6065825808945028,
  NOTE_MEETING_DATE: 3814025995259780,
  NOTE_AGE_DAYS: 8317625622630276,
  HAS_EVER_HAD_NOTE: 999276228153220,
};

// --- Non-Smartsheet API helpers (Graph, Granola) ---
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function httpsPost(url, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: { ...extraHeaders, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function refreshToken() {
  return new Promise((resolve, reject) => {
    const body = 'client_id=d43fa6d5-ac58-4c6a-a0a1-083a1573ab03&refresh_token='
      + encodeURIComponent(msalTokens.refresh_token)
      + '&grant_type=refresh_token&scope=openid%20profile%20email%20offline_access%20Calendars.Read%20User.Read';
    const req = https.request('https://login.microsoftonline.com/8222d14d-0869-42d3-8b7f-858c65b89c0e/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function graph(path, token) {
  return httpsGet('https://graph.microsoft.com/v1.0' + path, { 'Authorization': 'Bearer ' + token });
}

async function granolaDetail(id) {
  return httpsGet('https://public-api.granola.ai/v1/notes/' + id, { 'Authorization': 'Bearer ' + granolaToken });
}

async function granolaList(cursor) {
  const u = cursor
    ? 'https://public-api.granola.ai/v1/notes?page_size=30&cursor=' + encodeURIComponent(cursor)
    : 'https://public-api.granola.ai/v1/notes?page_size=30';
  return httpsGet(u, { 'Authorization': 'Bearer ' + granolaToken });
}

async function main() {
  // 1. Get fresh Graph token
  const r = await refreshToken();
  if (r.error) { console.log('Token refresh failed:', r.error); return; }
  const tok = r.access_token;
  console.log('Graph token obtained');

  // 2. Get upcoming events
  const nowStr = new Date().toISOString();
  const endStr = new Date(Date.now() + 14 * 86400000).toISOString();
  const upcoming = await graph('/me/calendarview?startDateTime=' + encodeURIComponent(nowStr)
    + '&endDateTime=' + encodeURIComponent(endStr) + '&$select=subject,id,seriesMasterId&$top=50', tok);
  const events = upcoming.value || [];
  const seriesMasters = [...new Set(events.filter(e => e.seriesMasterId).map(e => e.seriesMasterId))];
  console.log('Series masters found:', seriesMasters.length);

  // 3. Get past instances for each series
  const seriesData = {};
  for (const sm of seriesMasters) {
    const inst = await graph('/me/calendar/events/' + encodeURIComponent(sm)
      + '/instances?startDateTime=2026-08-01T00:00:00Z&endDateTime=2026-09-15T23:59:00Z&$select=subject,start,id&$top=20', tok);
    seriesData[sm] = (inst.value || []).sort((a, b) => new Date(b.start?.dateTime) - new Date(a.start?.dateTime));
  }

  // 4. Get ALL Granola notes
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

  // 5. Get details for relevant notes
  const relevantIds = allNotes.filter(n => {
    const t = n.title || '';
    return t.includes('NHS6') || t.includes('DOVA') || t.includes('KozPure')
      || t.includes('Boldyn') || t.includes('Dova Arena') || t.includes('4D Wind')
      || t.includes('weekly touch') || t.includes('weekly update');
  }).map(n => n.id);
  console.log('Relevant notes:', relevantIds.length);

  const noteDetails = {};
  for (const id of relevantIds) {
    noteDetails[id] = await granolaDetail(id);
  }

  // 6. Match series to notes
  const nowDate = new Date();
  const seriesEntries = [];

  for (const sm of seriesMasters) {
    const past = seriesData[sm] || [];
    const event = events.find(e => e.seriesMasterId === sm);
    const title = event?.subject || 'Unknown';

    let matchedNote = null;
    let matchedInstanceDate = null;

    for (const inst of past) {
      const instId = inst.id;
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
      hasEverHadNote,
    });
  }

  // 7. Write to Smartsheet (ROUTED THROUGH smartsheet.js)
  console.log('\n=== Writing to Smartsheet ===');

  const existing = await smartsheet.getSheet(PREP_MAP_SHEET);
  const existingIds = (existing.rows || []).map(r => r.id);
  if (existingIds.length > 0) {
    await smartsheet.deleteRows(PREP_MAP_SHEET, existingIds);
    console.log('Cleared', existingIds.length, 'existing rows');
  }

  let added = 0;
  for (const s of seriesEntries) {
    try {
      await smartsheet.addRow(PREP_MAP_SHEET, [
        { columnId: COLS.SERIES_MASTER_ID, value: s.seriesMasterId },
        { columnId: COLS.SERIES_TITLE, value: s.seriesTitle },
        { columnId: COLS.GRANOLA_NOTE_ID, value: s.granolaNoteId },
        { columnId: COLS.GRANOLA_NOTE_TITLE, value: s.granolaNoteTitle },
        { columnId: COLS.LAST_MATCHED_AT, value: s.lastMatchedAt },
        { columnId: COLS.NOTE_MEETING_DATE, value: s.noteMeetingDate },
        { columnId: COLS.NOTE_AGE_DAYS, value: String(s.noteAgeDays) },
        { columnId: COLS.HAS_EVER_HAD_NOTE, value: s.hasEverHadNote },
      ]);
      added++;
    } catch (e) {
      console.log('  FAIL:', e.message);
    }
  }
  console.log('Rows added:', added);
  console.log('\nDONE. ' + seriesEntries.length + ' series mapped.');
  console.log('With notes:', seriesEntries.filter(s => s.hasEverHadNote).length);
}

main().catch(e => console.log('Error:', e.message));