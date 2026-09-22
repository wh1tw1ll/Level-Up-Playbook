#!/usr/bin/env node
// generate-agenda.mjs — Creates meeting agendas 48 hours in advance
// Fetches calendar events, Granola notes, open tasks, builds agenda, sends to Telegram

import fs from 'fs';
import https from 'https';
import { URL } from 'url';

const HOME = 'C:/Users/HermesAdmin';
const TELEGRAM_CHAT = '8947918104';
const TENANT_ID = '8222d14d-0869-42d3-8b7f-858c65b89c0e';
const CLIENT_ID = 'd43fa6d5-ac58-4c6a-a0a1-083a1573ab03';

// ── HELPERS ────────────────────────────────────────────────────────

function readFile(path) {
  try { return fs.readFileSync(path, 'utf8').trim(); } catch { return null; }
}

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

function httpsPostForm(url, formData) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(formData).toString();
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) }
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

function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const CANONICAL = {
  'whitney': 'Whitney Williams', 'whitney williams': 'Whitney Williams',
  'greg': 'Greg Wieting', 'greg wieting': 'Greg Wieting',
  'charlie': 'Charlie Tiwana', 'sam': 'Sam Kalscheur',
};

function normalizeOwner(name) { if (!name) return null; const k = name.trim().toLowerCase(); return CANONICAL[k] || name.trim(); }
function isWhitney(owner) { return owner && owner.toLowerCase().includes('whitney'); }

function resolveProject(subject) {
  const s = subject.toLowerCase();
  if (s.includes('dova') || s.includes('cordova')) return 'DOVA';
  if (s.includes('mfp') || s.includes('miami') || s.includes('boldyn')) return 'MFP';
  if (s.includes('nhs6') || s.includes('sphere')) return 'Sphere';
  if (s.includes('level up') || s.includes('business')) return 'Business';
  return 'Unassigned';
}

function formatTimeET(dtStr) {
  try { return new Date(dtStr).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }); }
  catch { return dtStr; }
}

function formatDateET(dtStr) {
  try { return new Date(dtStr).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }); }
  catch { return dtStr; }
}

// ── TOKENS ─────────────────────────────────────────────────────────

function getGranolaToken() { return readFile(`${HOME}/.hermes/granola_token.txt`); }
function getSmartsheetToken() { return readFile(`${HOME}/.hermes/.smartsheet_token`); }
function getTelegramToken() { return readFile(`${HOME}/.hermes/telegram_token.txt`); }

async function refreshGraphToken() {
  const msal = JSON.parse(readFile(`${HOME}/.hermes/msal_tokens.json`) || '{}');
  if (!msal.refresh_token) { console.log('No MSAL token'); return null; }
  const result = await httpsPostForm('https://login.microsoftonline.com/' + TENANT_ID + '/oauth2/v2.0/token', {
    client_id: CLIENT_ID,
    refresh_token: msal.refresh_token,
    grant_type: 'refresh_token',
    scope: 'openid profile email offline_access Calendars.Read User.Read',
  }).catch(e => { console.log('Token refresh error:', e.message); return null; });
  return result?.access_token || null;
}

async function graph(path, token) {
  return httpsGet('https://graph.microsoft.com/v1.0' + path, { Authorization: 'Bearer ' + token });
}

// ── GRANOLA ────────────────────────────────────────────────────────

async function granolaList(cursor) {
  const token = getGranolaToken();
  if (!token) return null;
  const u = cursor ? `https://public-api.granola.ai/v1/notes?page_size=30&cursor=${encodeURIComponent(cursor)}` : 'https://public-api.granola.ai/v1/notes?page_size=30';
  return httpsGet(u, { Authorization: 'Bearer ' + token });
}

async function granolaDetail(id) {
  const token = getGranolaToken();
  if (!token) return null;
  return httpsGet(`https://public-api.granola.ai/v1/notes/${id}`, { Authorization: 'Bearer ' + token }).catch(() => null);
}

// ── SMARTSHEET ──────────────────────────────────────────────────────

async function smartsheetGet(path) {
  const token = getSmartsheetToken();
  if (!token) return null;
  return httpsGet(`https://api.smartsheet.com/2.0${path}`, { Authorization: 'Bearer ' + token });
}

async function fetchOpenTasks() {
  const SHEETS = [['4456864287772548', 'project'], ['2802755367554948', 'personal']];
  const tasks = [];
  for (const [sid, src] of SHEETS) {
    const data = await smartsheetGet(`/sheets/${sid}`);
    if (!data || !data.rows) continue;
    const cols = {};
    for (const c of data.columns || []) cols[c.title] = c.id;
    for (const row of data.rows) {
      const cells = {};
      for (const c of row.cells || []) {
        for (const [title, cid] of Object.entries(cols)) {
          if (c.columnId === cid) cells[title] = c.displayValue || c.value || '';
        }
      }
      const status = String(cells.Status || '');
      if (['Complete', 'Archived', 'Closed'].includes(status)) continue;
      const action = String(cells['Action ID'] || '').trim();
      if (action.length < 5) continue;
      tasks.push({
        actionItem: action.slice(0, 150), status,
        owner: String(cells.Owner || ''), project: String(cells.Project || ''),
        dueDate: String(cells['Due Date'] || ''), category: String(cells.Category || ''),
        statusNote: String(cells['Status Note'] || ''), source: src,
      });
    }
  }
  return tasks;
}

// ── AGENDA ──────────────────────────────────────────────────────────

function extractActionItems(md) {
  if (!md) return [];
  const items = [];
  let inNS = false;
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (/^#+\s+Next Steps/i.test(t)) { inNS = true; continue; }
    if (inNS && (t.startsWith('---') || (/^#+\s/.test(t) && !/Next Steps/i.test(t)))) { inNS = false; continue; }
    if (!inNS || !t.startsWith('- ')) continue;
    const om = t.match(/\(([^)]+)\)\s*$/);
    const ownerRaw = om ? om[1].trim() : null;
    const am = t.match(/\*\*(.+?)\*\*/);
    let action = am ? am[1].trim() : t.replace(/^- /, '').trim();
    action = action.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (action && action.length >= 3) items.push({ ownerRaw, text: action });
  }
  return items;
}

function buildAgenda(event, noteDetail, tasks) {
  const subject = event.subject || 'Meeting';
  const startStr = event.start?.dateTime || '';
  const endStr = event.end?.dateTime || '';
  const location = event.location?.displayName || '';
  const attendees = event.attendees || [];
  const timeET = formatTimeET(startStr);
  const dateLabel = formatDateET(startStr);
  let duration = '';
  if (startStr && endStr) {
    try { const mins = Math.round((new Date(endStr) - new Date(startStr)) / 60000); duration = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`; } catch {}
  }

  let h = `<b>📋 MEETING AGENDA</b>\n\n<b>${escapeHtml(subject)}</b>\n📅 ${dateLabel} · ${timeET}`;
  if (duration) h += ` · ${duration}`;
  h += '\n';
  if (location) h += `📍 ${escapeHtml(location)}\n`;
  if (attendees.length) {
    const names = attendees.map(a => {
      const addr = a.emailAddress || {};
      return (addr.name || addr.address || '');
    });
    h += `👥 ${escapeHtml(names.slice(0, 10).join(', '))}\n`;
  }
  h += '\n' + '─'.repeat(25) + '\n\n';

  // ── CONTEXT FROM PREVIOUS MEETING NOTES ──
  if (noteDetail) {
    const summary = noteDetail.summary_text || '';
    if (summary) {
      h += `<b>PREVIOUS MEETING NOTES</b>\n${escapeHtml(summary.slice(0, 500))}\n`;
      if (summary.length > 500) h += '...\n';
      h += '\n';
    }
    const items = extractActionItems(noteDetail.summary_markdown || '');
    if (items.length) {
      h += `<b>PREVIOUS ACTION ITEMS (${items.length})</b>\n`;
      for (const item of items.slice(0, 5)) {
        const owner = normalizeOwner(item.ownerRaw);
        const os = owner ? ` [${owner}]` : '';
        h += `  ☐ ${escapeHtml(item.text)}${os}\n`;
      }
      if (items.length > 5) h += `  ... +${items.length - 5} more\n`;
      h += '\n';
    }
  } else {
    h += `<i>⚠ No prior meeting notes available — review recent emails for context.</i>\n\n`;
  }

  // ── DUE THIS WEEK ──
  // Only show due-soon items that are actually Whitney's or directly relevant
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const dueSoon = tasks.filter(t =>
    t.dueDate && t.dueDate <= weekEnd
    && (t.owner && isWhitney(t.owner))
  );
  if (dueSoon.length) {
    h += `<b>⚠ ITEMS I OWE (due this week)</b>\n`;
    for (const t of dueSoon.slice(0, 5)) {
      h += `  ☐ ${escapeHtml(t.actionItem)}\n`;
    }
    if (dueSoon.length > 5) h += `  ... +${dueSoon.length - 5} more\n`;
    h += '\n';
  }

  h += '─'.repeat(25) + '\n';
  h += `<i>Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</i>`;
  return h;
}

function matchNote(event, allNotes) {
  const subject = (event.subject || '').toLowerCase().trim();
  for (const note of allNotes) {
    const title = (note.title || '').toLowerCase().trim();
    const sw = new Set(subject.replace(/[^a-z0-9\s]/g, '').split(/\s+/));
    const tw = new Set(title.replace(/[^a-z0-9\s]/g, '').split(/\s+/));
    const common = [...sw].filter(x => tw.has(x));
    if (common.length >= 3 && common.length / Math.max(sw.size, tw.size, 1) >= 0.4) return note;
  }
  return null;
}

// ── POST TO LUCI API ────────────────────────────────────────────────────

async function postAgendas(agendas) {
  const url = 'https://luci-by-levelup.vercel.app/api/prep/agendas';
  try {
    const result = await httpsPost(url, { agendas }, {});
    return result?.ok || false;
  } catch (e) { console.log('API post error:', e.message); return false; }
}

// ── MAIN ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== AGENDA GENERATOR ===');
  const token = await refreshGraphToken();
  if (!token) { console.log('FAILED: No Graph token'); process.exit(1); }

  const now = new Date();
  const targetStart = new Date(now.getTime() + 42 * 3600000).toISOString();
  const targetEnd = new Date(now.getTime() + 54 * 3600000).toISOString();

  let data = await graph(`/me/calendarview?startDateTime=${encodeURIComponent(targetStart)}&endDateTime=${encodeURIComponent(targetEnd)}&$select=subject,start,end,location,id,isAllDay,attendees&$top=20`, token);

  if (!data?.value?.length) {
    // Try wider window
    const wideStart = new Date(now.getTime() + 36 * 3600000).toISOString();
    const wideEnd = new Date(now.getTime() + 60 * 3600000).toISOString();
    data = await graph(`/me/calendarview?startDateTime=${encodeURIComponent(wideStart)}&endDateTime=${encodeURIComponent(wideEnd)}&$select=subject,start,end,location,id,isAllDay,attendees&$top=20`, token);
  }

  const events = (data?.value || []).filter(e => !e.isAllDay);
  if (!events.length) {
    console.log('No meetings in window');
    await postAgendas([]);
    return;
  }
  console.log(`Meetings: ${events.length}`);

  console.log('Fetching Granola notes...');
  const allNotes = [];
  let cursor = null;
  while (true) {
    const page = await granolaList(cursor);
    if (!page) break;
    allNotes.push(...(page.notes || []));
    if (!page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }
  console.log(`Granola notes: ${allNotes.length}`);

  console.log('Fetching tasks...');
  const allTasks = await fetchOpenTasks();
  console.log(`Tasks: ${allTasks.length}`);

  const agendas = [];
  for (const event of events) {
    const subject = event.subject || '';
    if (!subject || subject === 'Untitled' || subject.startsWith('[')) continue;

    const note = matchNote(event, allNotes);
    const noteDetail = note ? await granolaDetail(note.id) : null;

    const agenda = buildAgenda(event, noteDetail, allTasks);
    agendas.push({
      meetingSubject: subject,
      meetingTime: event.start?.dateTime || '',
      duration: (event.start?.dateTime && event.end?.dateTime)
        ? Math.round((new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 60000) : 0,
      hasPriorNotes: !!noteDetail,
      agendaHtml: agenda,
    });
    console.log(`  ${noteDetail ? '✅' : '⚠️'} ${subject}`);
  }

  console.log(`\nPublishing ${agendas.length} agendas to LUCI page...`);
  await postAgendas(agendas);
  console.log('Done.');
}

main().catch(e => { console.log('Fatal:', e.message); process.exit(1); });