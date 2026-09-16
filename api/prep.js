// api/prep.js — Meeting Prep View (v2 with full detail sections)
// Part 7 of the LUCI widget
// MATCHES ON SERIES via seriesMasterId
// Returns full prep data: past notes, tracker items, email freshness

const GRANOLA_API = 'https://public-api.granola.ai/v1';
const GRANOLA_TOKEN = () => process.env.GRANOLA_TOKEN;
const DAYS_AHEAD = 14;

// ============================================================
// SERIES-TO-NOTE MAP (cached in-memory)
// ============================================================

let _prepMap = null;
let _mapCacheTime = 0;
const MAP_TTL = 5 * 60 * 1000;

const KNOWN_MAP = {
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xHzHrgAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW1gAAEA==": { seriesTitle: "4D Wind Effect & Lift Coordination", granolaNoteId: "not_EFEU1ZY5XDaFph", granolaNoteTitle: "4D Wind Effect & Lift Coordination", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-14", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAAM5QuI6AAA=": { seriesTitle: "Zoom - Level Up | KozPure re: weekly touch point", granolaNoteId: "not_o9Da8a6cjynzT4", granolaNoteTitle: "Zoom - Level Up | KozPure re: weekly touch point", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-08-19", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0gAAEA==": { seriesTitle: "NHS6 - Weekly M, E, P, LV, AV Coordination", granolaNoteId: "not_XFxVKiCz4DbJBb", granolaNoteTitle: "FW: NHS6 - Weekly M, E, P, LV, AV Coordination", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-15", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3w7OdREAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADRcQE9AAAEA==": { seriesTitle: "DOVA | Weekly Civil Touch-Base", granolaNoteId: "not_qKk6oZ4sLF3PV2", granolaNoteTitle: "DOVA | Weekly Civil Touch-Base", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-10", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0wAAEA==": { seriesTitle: "NHS6 - Weekly Enclosure Coordination", granolaNoteId: "not_s0IFaCJf6prfnn", granolaNoteTitle: "NHS6 - Weekly Enclosure Coordination", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-15", hasEverHadNote: true }
};

const NO_NOTE_SERIES = new Set([
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAAMO7LmWAAA=",
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAAMyJvrIAAA=",
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bUAAA=",
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bRAAA=",
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bVAAA=",
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bXAAA="
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
// MAIN HANDLER
// ============================================================

export default async function handler(req, res) {
  const { setCors, handleOptions, authenticateRequest } = await import('../lib/auth.js');
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const fresh = await authenticateRequest(req, res, 'Calendars.Read Calendars.Read.Shared');
  if (!fresh) return;

  try {
    // Parse query: ?expand=detail to get full prep detail for a specific event
    const expandFor = req.query.eventId || null;
    const projectFilter = req.query.project || null;

    const now = new Date().toISOString();
    const end = new Date(Date.now() + DAYS_AHEAD * 86400000).toISOString();

    // Fetch calendar events with seriesMasterId
    const primaryUrl = `/me/calendarview?startDateTime=${encodeURIComponent(now)}&endDateTime=${encodeURIComponent(end)}&$select=subject,start,end,location,isAllDay,id,seriesMasterId,type&$top=50`;
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

    // Build series map
    const seriesMap = { ...KNOWN_MAP };

    // Process each event
    const enrichedEvents = [];

    for (const event of allEvents) {
      const hasSeries = !!event.seriesMasterId;
      let noteInfo = null;
      let neverHadNote = false;
      let pastNotes = [];

      if (hasSeries) {
        // Check known map
        const entry = seriesMap[event.seriesMasterId];
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
        } else if (NO_NOTE_SERIES.has(event.seriesMasterId)) {
          neverHadNote = true;
        }
      }

      // Time display
      const timeET = event.start?.dateTime
        ? formatET(event.start.dateTime) + (event.end?.dateTime ? ' - ' + formatET(event.end.dateTime) : '') + ' ET'
        : '';
      const dateET = event.start?.dateTime ? formatDateET(event.start.dateTime) : '';

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
        attendees: noteInfo?.attendees || []
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
    if (t.startsWith('# Next Steps')) { inNextSteps = true; continue; }
    if (inNextSteps && t.startsWith('# ') && !t.startsWith('# Next Steps')) continue;
    if (inNextSteps && t.startsWith('- ')) {
      const assignees = [...t.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1]);
      let text = t.replace(/^- /, '').trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
      items.push({ assignees: assignees.length > 0 ? assignees : ['Unassigned'], text });
    }
  }
  if (items.length === 0) {
    const m = summaryMarkdown.matchAll(/- \*\*([^*]+)\*\*([^-]*)/g);
    for (const match of m) {
      const text = match[2].trim();
      if (text) items.push({ assignees: [match[1].trim()], text });
    }
  }
  return items;
}

export const config = { maxDuration: 30 };