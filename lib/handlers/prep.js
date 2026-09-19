// api/prep.js — Meeting Prep View (v2 with full detail sections)
// Part 7 of the LUCI widget
// MATCHES ON SERIES via seriesMasterId
// Returns full prep data: past notes, tracker items, email freshness

import smartsheet from '../smartsheet.js';

const GRANOLA_API = 'https://public-api.granola.ai/v1';
const GRANOLA_TOKEN = () => process.env.GRANOLA_TOKEN;
const DAYS_AHEAD = 14;
const DAYS_BEHIND = 7; // Show meetings from this week too, not just upcoming

// ============================================================
// Prep Map — loaded from Smartsheet Prep Map (4624981133310596)
// Cached in-memory with TTL, replaces hardcoded KNOWN_MAP
// ============================================================
// Canonical Prep Map sheet (resolved by resolve-duplicates)
const PREP_MAP_NAME = 'Prep Map';
const PREP_MAP_ID = '1007659559112580';

async function getPrepMapSheetId() {
  // First try the known canonical ID — it's deterministic and fast
  try {
    const home = await smartsheet.getHome();
    const found = (home.sheets || []).filter(s => s.name === PREP_MAP_NAME);
    if (found.length === 1) return found[0].id;
    if (found.length > 1) throw new Error(`Duplicate Prep Map sheets: ${found.map(s=>s.id).join(', ')}`);
    // Not found — return null, loadPrepMap will handle gracefully
    return null;
  } catch {
    return null;
  }
}

let _prepMap = null;
let _mapCacheTime = 0;
const MAP_TTL = 5 * 60 * 1000;

async function loadPrepMap() {
  if (_prepMap && (Date.now() - _mapCacheTime) < MAP_TTL) return _prepMap;
  
  try {
    const sheetId = await getPrepMapSheetId();
    if (!sheetId) { _prepMap = {}; _mapCacheTime = Date.now(); return {}; }
    const sheet = await smartsheet.getSheetWithColumns(sheetId);
    if (!sheet || !sheet.rows) { _prepMap = {}; _mapCacheTime = Date.now(); return {}; }
    
    const cols = {};
    for (const c of sheet.columns || []) cols[c.title] = c.id;
    
    const map = {};
    const noNote = new Set();
    
    for (const row of sheet.rows || []) {
      const cells = {};
      for (const c of row.cells || []) {
        for (const [title, id] of Object.entries(cols)) {
          if (c.columnId === id) cells[title] = c.displayValue || c.value || '';
        }
      }
      
      // Key by seriesMasterId for series-level lookup, eventId for instance lookup
      const seriesId = cells['SeriesMasterId'] || '';
      const eventId = cells['EventId'] || '';
      
      if (seriesId) {
        map['series:' + seriesId] = {
          seriesTitle: cells['Subject'] || cells['SeriesTitle'] || '',
          granolaNoteId: cells['GranolaNoteId'] || '',
          granolaNoteTitle: cells['GranolaNoteTitle'] || '',
          lastMatchedAt: cells['LastMatchedAt'] || cells['Date'] || '',
          noteMeetingDate: cells['NoteMeetingDate'] || cells['Date'] || '',
          hasEverHadNote: cells['HasEverHadNote'] === 'true' || cells['HasEverHadNote'] === true,
          eventId: eventId,
        };
      }
      
      if (eventId) {
        map['event:' + eventId] = {
          seriesTitle: cells['Subject'] || '',
          granolaNoteId: cells['GranolaNoteId'] || '',
          granolaNoteTitle: cells['GranolaNoteTitle'] || '',
          noteMeetingDate: cells['Date'] || '',
          hasEverHadNote: cells['HasEverHadNote'] === 'true' || cells['HasEverHadNote'] === true,
          seriesMasterId: seriesId,
        };
      }
      
      if (!cells['HasEverHadNote'] || cells['HasEverHadNote'] === 'false') {
        if (seriesId) noNote.add(seriesId);
        if (eventId) noNote.add(eventId);
      }
    }
    
    _prepMap = { map, noNote };
    _mapCacheTime = Date.now();
    return _prepMap;
  } catch (e) {
    console.error('Prep Map load failed:', e.message);
    _prepMap = { map: {}, noNote: new Set() };
    _mapCacheTime = Date.now();
    return _prepMap;
  }
}

const NO_NOTE_SERIES = new Set([
  // Populated from Prep Map via loadPrepMap()
]);

// ============================================================
// PROJECT RESOLUTION
// ============================================================

function resolveProject(subject) {
  const s = subject.toLowerCase();
  if (s.includes('dova') || s.includes('cordova')) return { project: 'DOVA', rung: 1 };
  if (s.includes('mfp') || s.includes('miami freedom')) return { project: 'MFP', rung: 1 };
  if (s.includes('boldyn')) return { project: 'MFP', rung: 2 };
  if (s.includes('kozpure') || s.includes('level up')) return { project: 'DOVA', rung: 2 };
  if (s.includes('nhs6') || s.includes('sphere')) return { project: 'Sphere', rung: 1 };
  if (s.includes('business') || s.includes('intro') || s.includes('l&s') || s.includes('jones')) return { project: 'Business', rung: 1 };
  if (s.includes('stadium ops') || s.includes('sub closeout') || s.includes('kroll') || s.includes('arq') || s.includes('troutman') || s.includes('socotec') || s.includes('internal lu') || s.includes('owner')) return { project: 'MFP', rung: 1 };
  return { project: 'Unassigned', rung: 0 };
}

// ============================================================
// TIME HELPERS
// ============================================================

function formatET(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateET(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  const today = new Date();
  const t = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  const dStr = d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const tStr = today.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const tm = new Date(today); tm.setDate(tm.getDate() + 1);
  const tmStr = tm.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  if (dStr === tStr) return 'Today, ' + t;
  if (dStr === tmStr) return 'Tomorrow, ' + t;
  return t;
}

// ============================================================
// GRANOLA API
// ============================================================

async function fetchGranolaNotes() {
  const token = GRANOLA_TOKEN();
  if (!token) return [];
  try {
    let all = [];
    let cursor = null;
    while (true) {
      const url = cursor ? `${GRANOLA_API}/notes?page_size=30&cursor=${encodeURIComponent(cursor)}` : `${GRANOLA_API}/notes?page_size=30`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) break;
      const data = await res.json();
      all = all.concat(data.notes || []);
      if (!data.hasMore) break;
      cursor = data.cursor;
      if (!cursor) break;
    }
    return all;
  } catch (e) { return []; }
}

async function fetchGranolaDetail(noteId) {
  const token = GRANOLA_TOKEN();
  if (!token) return null;
  try {
    const res = await fetch(`${GRANOLA_API}/notes/${noteId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// ============================================================
// GRAPH API
// ============================================================

async function graphGet(path, token) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json();
}

// ============================================================
// SMARTSHEET TASKS
// ============================================================

async function fetchOpenTasks() {
  try {
    const sheets = [
      { id: '4456864287772548', source: 'project' },
      { id: '2802755367554948', source: 'personal' }
    ];
    let all = [];
    for (const s of sheets) {
      const data = await smartsheet.getSheet(s.id);
      if (!data) continue;
      const cols = {};
      for (const c of data.columns || []) cols[c.title] = c.id;
      for (const row of data.rows || []) {
        const cells = {};
        for (const c of row.cells || []) {
          for (const [title, id] of Object.entries(cols)) {
            if (c.columnId === id) cells[title] = c.displayValue || c.value || '';
          }
        }
        const status = String(cells.Status || '');
        if (['Complete', 'Archived', 'Closed'].includes(status)) continue;
        const title = String(cells['Action ID'] || '').substring(0, 150);
        if (title.length < 5) continue;
        all.push({
          rowId: row.id,
          actionItem: title,
          status,
          owner: String(cells.Owner || ''),
          project: String(cells.Project || ''),
          category: String(cells.Category || ''),
          dueDate: String(cells['Due Date'] || ''),
          statusNote: String(cells['Status Note'] || ''),
          source: s.source
        });
      }
    }
    return all;
  } catch (e) { return []; }
}

// ============================================================
// OWNER NORMALIZATION
// ============================================================

function normalizeOwner(owner) {
  if (!owner) return 'Unassigned';
  const o = owner.trim();
  const map = {
    'whitney': 'Whitney Williams',
    'charlie': 'Charlie Tiwana',
    'greg, whitney': 'Greg Wieting, Whitney Williams',
    'sam kalscheur; whitney williams': 'Whitney Williams, Sam Kalscheur',
  };
  const key = o.toLowerCase();
  return map[key] || o;
}

// ============================================================
// SERIES-BASED TASK MATCHING VIA SOURCEREF
// ============================================================

function buildSeriesReverseMap(prepMapData) {
  // Map granolaNoteTitle -> seriesMasterId from Prep Map
  const pm = prepMapData?.map || {};
  const map = {};
  for (const [key, entry] of Object.entries(pm)) {
    if (!key.startsWith('series:')) continue;
    if (entry.granolaNoteTitle) {
      map[entry.granolaNoteTitle.toLowerCase()] = key.replace('series:', '');
    }
    if (entry.seriesTitle) {
      map[entry.seriesTitle.toLowerCase()] = key.replace('series:', '');
    }
  }
  return map;
}

function matchTasksToSeries(allOpenTasks, seriesReverseMap) {
  // Returns: { seriesMasterId -> { owedItems: [], whitneyItems: [] } }
  const result = {};
  
  for (const task of allOpenTasks) {
    if (['Complete', 'Archived', 'Closed'].includes(task.status)) continue;
    
    const sourceRef = (task.sourceRef || '').trim();
    let matchedSeriesId = null;
    
    // Strategy A: SourceRef points to a Granola note
    if (sourceRef && sourceRef.toLowerCase().startsWith('granola:')) {
      // Extract meeting name from SourceRef: "Granola: Meeting Name (Date)"
      const meetingName = sourceRef.replace(/^granola:\s*/i, '').replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
      matchedSeriesId = seriesReverseMap[meetingName] || null;
    }
    
    // Strategy B: Explicit tag (not implemented yet — future use)
    // Strategy C: No match — skip
    
    if (!matchedSeriesId) continue;
    
    // Normalize owner
    const normalizedOwner = normalizeOwner(task.owner);
    const ownerLower = normalizedOwner.toLowerCase();
    
    if (!result[matchedSeriesId]) {
      result[matchedSeriesId] = { owedItems: [], whitneyItems: [] };
    }
    
    // Check if Whitney owns this
    const isWhitney = ownerLower.includes('whitney williams') || ownerLower.includes('whitney');
    
    if (isWhitney) {
      result[matchedSeriesId].whitneyItems.push({
        ...task,
        owner: normalizedOwner
      });
    } else {
      result[matchedSeriesId].owedItems.push({
        ...task,
        owner: normalizedOwner
      });
    }
  }
  
  return result;
}

export default async function handler(req, res) {
  const { setCors, handleOptions, authenticateRequest } = await import('../auth.js');
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const fresh = await authenticateRequest(req, res, 'Calendars.Read Calendars.Read.Shared');
  if (!fresh) return;

  try {
    // Parse query: ?expand=detail to get full prep detail for a specific event
    const expandFor = req.query.eventId || null;
    const projectFilter = req.query.project || null;

    const start = new Date(Date.now() - DAYS_BEHIND * 86400000).toISOString();
    const end = new Date(Date.now() + DAYS_AHEAD * 86400000).toISOString();

    // Fetch calendar events with seriesMasterId from start to end (past week + next 2 weeks)
    const primaryUrl = `/me/calendarview?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$select=subject,start,end,location,isAllDay,id,seriesMasterId,type&$top=50`;
    const primaryData = await graphGet(primaryUrl, fresh.access_token);
    let allEvents = (primaryData?.value || []).map(e => ({
      subject: e.subject || '',
      start: e.start,
      end: e.end,
      location: e.location?.displayName || '',
      isAllDay: e.isAllDay || false,
      eventId: e.id || '',
      seriesMasterId: e.seriesMasterId || null,
      type: e.type || 'singleInstance'
    }));

    // Filter by project if specified
    allEvents = allEvents.map(e => {
      const p = resolveProject(e.subject);
      return { ...e, project: p.project, project_rung: p.rung };
    });

    if (projectFilter) {
      allEvents = allEvents.filter(e => e.project === projectFilter);
    }

    // Sort
    allEvents.sort((a, b) => new Date(a.start?.dateTime || 0) - new Date(b.start?.dateTime || 0));

    // Load Prep Map (dynamic, from Smartsheet — replaces KNOWN_MAP)
    const prepMapData = await loadPrepMap();
    const seriesMap = prepMapData.map || {};
    const noNoteSet = prepMapData.noNote || new Set();

    // Fetch open tasks from Smartsheet for prep sections
    const allOpenTasks = await fetchOpenTasks();

    // Build series reverse map ONCE and match tasks via SourceRef
    const seriesReverseMap = buildSeriesReverseMap(prepMapData);
    const seriesTaskMap = matchTasksToSeries(allOpenTasks, seriesReverseMap);

    // Process each event
    const enrichedEvents = [];

    for (const event of allEvents) {
      const hasSeries = !!event.seriesMasterId;
      let noteInfo = null;
      let neverHadNote = false;
      let pastNotes = [];

      if (hasSeries) {
        // Look up in Prep Map by seriesMasterId or eventId
        const entry = seriesMap['series:' + event.seriesMasterId] || seriesMap['event:' + event.eventId] || null;
        if (entry) {
          if (entry.hasEverHadNote) {
            noteInfo = entry;
            // Fetch note detail
            const detail = await fetchGranolaDetail(entry.granolaNoteId);
            if (detail) {
              noteInfo.summaryMarkdown = detail.summary_markdown || '';
              noteInfo.summaryText = (detail.summary_text || '').substring(0, 500);
              noteInfo.actionItems = extractActionItems(detail.summary_markdown);
              noteInfo.webUrl = detail.web_url || null;
              noteInfo.attendees = (detail.calendar_event?.invitees || []).map(i => i.email || i.name || '').filter(Boolean);
            }
            // Fetch past instances (last 3) for this series
            try {
              const pastStart = new Date(Date.now() - 60 * 86400000).toISOString();
              const pastEnd = event.start?.dateTime || now;
              const instUrl = `/me/calendar/events/${encodeURIComponent(event.seriesMasterId)}/instances?startDateTime=${encodeURIComponent(pastStart)}&endDateTime=${encodeURIComponent(pastEnd)}&$select=subject,start,id&$top=10`;
              const instData = await graphGet(instUrl, fresh.access_token);
              const instances = (instData?.value || []).sort((a, b) => new Date(b.start?.dateTime) - new Date(a.start?.dateTime));
              // Get Granola notes for each past instance
              for (const inst of instances.slice(0, 3)) {
                // Try to find a Granola note for this instance
                const allNotes = await fetchGranolaNotes();
                const matchNote = allNotes.find(n => n.calendar_event?.calendar_event_id === inst.id);
                if (matchNote) {
                  const nd = await fetchGranolaDetail(matchNote.id);
                  if (nd) {
                    pastNotes.push({
                      date: inst.start?.dateTime,
                      summary: (nd.summary_text || '').substring(0, 300),
                      actionItems: extractActionItems(nd.summary_markdown)
                    });
                  }
                }
              }
            } catch (e) {
              // Past instances fetch is optional
            }
          } else {
            neverHadNote = true;
          }
        } else if (noNoteSet.has(event.seriesMasterId) || noNoteSet.has(event.eventId)) {
          neverHadNote = true;
        }
      }

      // Time display
      const timeET = event.start?.dateTime
        ? formatET(event.start.dateTime) + (event.end?.dateTime ? ' - ' + formatET(event.end.dateTime) : '') + ' ET'
        : '';
      const dateET = event.start?.dateTime ? formatDateET(event.start.dateTime) : '';

      // Get series-matched tasks for this event (via SourceRef)
      const seriesItems = event.seriesMasterId ? seriesTaskMap[event.seriesMasterId] : null;
      let owedItems = seriesItems?.owedItems || [];
      let whitneyItems = seriesItems?.whitneyItems || [];

      // Fallback: if no SourceRef-matched items, populate from Granola note's Next Steps
      if (owedItems.length === 0 && whitneyItems.length === 0 && noteInfo?.actionItems && noteInfo.actionItems.length > 0) {
        for (const item of noteInfo.actionItems) {
          // Determine owner: from raw owner in parens, or apply semantic rule
          let resolvedOwner = null;
          if (item.ownerRaw) {
            // Check for multi-owner in the parens value
            const raw = item.ownerRaw;
            if (/[,;\/&]|(\s+and\s+)/i.test(raw)) {
              resolvedOwner = null; // Multi-owner — flag for assignment
            } else {
              // Canonicalize
              const map = { 'whitney': 'Whitney Williams', 'charlie': 'Charlie Tiwana', 'greg': 'Greg Wieting', 'sam': 'Sam Kalscheur', 'philip': 'Philip', 'victoria': 'Victoria', 'paul': 'Paul', 'brandon': 'Brandon' };
              resolvedOwner = map[raw.toLowerCase().trim()] || raw;
            }
          }
          // Semantic rule: action directed AT someone -> Whitney owns it
          if (!resolvedOwner) {
            const lower = item.text.toLowerCase();
            if (/^(call|email|follow\s+up\s+with|reach\s+out\s+to|contact|send|text)\s+\w+/i.test(lower)) {
              resolvedOwner = 'Whitney Williams';
            }
          }

          const task = {
            actionItem: item.text,
            owner: resolvedOwner || '',
            status: resolvedOwner ? 'Not Started' : 'Needs Owner',
            dueDate: '',
            sourceRef: noteInfo.granolaNoteTitle || '',
            source: 'project'
          };

          if (!resolvedOwner) {
            owedItems.push(task); // Needs owner — show as owed for now
          } else if (resolvedOwner === 'Whitney Williams' || resolvedOwner.toLowerCase().includes('whitney')) {
            whitneyItems.push(task);
          } else {
            owedItems.push(task);
          }
        }
      }
      
            enrichedEvents.push({
              subject: event.subject,
        start: event.start,
        end: event.end,
        location: event.location,
        isAllDay: event.isAllDay,
        eventId: event.eventId,
        seriesMasterId: event.seriesMasterId,
        isRecurring: hasSeries,
        project: event.project,
        project_rung: event.project_rung,
        timeET,
        dateET,
        // Granola
        hasGranolaNote: !!noteInfo?.hasEverHadNote,
        neverHadNote,
        granolaNoteId: noteInfo?.granolaNoteId || null,
        granolaNoteTitle: noteInfo?.granolaNoteTitle || null,
        granolaNoteDate: noteInfo?.noteMeetingDate || null,
        granolaStaleDays: noteInfo?.noteMeetingDate ? Math.round((Date.now() - new Date(noteInfo.noteMeetingDate).getTime()) / 86400000) : null,
        granolaWebUrl: noteInfo?.webUrl || null,
        summaryPreview: noteInfo?.summaryText || '',
        summaryMarkdown: noteInfo?.summaryMarkdown || '',
        actionItems: noteInfo?.actionItems || [],
        pastNotes,
        attendees: noteInfo?.attendees || [],
        owedItems,
        whitneyItems
      });
    }

    res.json({ events: enrichedEvents });
  } catch (e) {
    console.error('Prep API error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// ============================================================
// ACTION ITEM EXTRACTION
// ============================================================

function extractActionItems(summaryMarkdown) {
  if (!summaryMarkdown) return [];
  const items = [];
  const lines = summaryMarkdown.split('\n');
  let inNextSteps = false;
  for (const line of lines) {
    const t = line.trim();
    // Detect 'Next Steps' at any heading level (#, ##, ###)
    if (/^#+\s+Next Steps/i.test(t)) { inNextSteps = true; continue; }
    // Exit on next heading or end-of-section marker
    if (inNextSteps && (t.startsWith('---') || (/^#+\s/.test(t) && !/Next Steps/i.test(t)))) {
      inNextSteps = false;
      continue;
    }
    if (!inNextSteps || !t.startsWith('- ')) continue;

    // Owner is in trailing (parens) after the bold section
    const ownerMatch = t.match(/\(([^)]+)\)\s*$/);
    const ownerRaw = ownerMatch ? ownerMatch[1].trim() : null;

    // Action text is between **...**
    const actionMatch = t.match(/\*\*(.+?)\*\*/);
    const action = actionMatch ? actionMatch[1].trim() : t.replace(/^- /, '').trim().replace(/\s*\([^)]*\)\s*$/, '').trim();

    if (action && action.length >= 3) {
      items.push({ ownerRaw, text: action });
    }
  }
  // Fallback for non-** format
  if (items.length === 0) {
    const m = summaryMarkdown.matchAll(/- ([^-].+)/g);
    for (const match of m) {
      const raw = match[1].trim();
      const ownerMatch = raw.match(/\(([^)]+)\)\s*$/);
      const ownerRaw = ownerMatch ? ownerMatch[1].trim() : null;
      const action = ownerMatch ? raw.replace(/\s*\([^)]*\)\s*$/, '').trim() : raw;
      if (action && action.length >= 3) {
        items.push({ ownerRaw, text: action });
      }
    }
  }
  return items;
}

export const config = { maxDuration: 30 };