// api/prep.js — Meeting Prep View
// Part 7 of the LUCI widget
// MATCHES ON SERIES via seriesMasterId, not on event ID
// Uses cached map built by cron; falls back to inline data

const GRANOLA_API = 'https://public-api.granola.ai/v1';
const GRANOLA_TOKEN = () => process.env.GRANOLA_TOKEN;

const DAYS_AHEAD = 14;

// ============================================================
// SERIES-TO-NOTE MAP (built by cron, cached in-memory)
// ============================================================

// The map: seriesMasterId -> note info
// Populated by cron job, hardcoded fallback below
let _prepMap = null;
let _mapCacheTime = 0;
const MAP_TTL = 5 * 60 * 1000; // 5 minutes

// Known series map (from last successful cron run)
// This is the fallback if the map endpoint is unavailable
const KNOWN_MAP = {
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xHzHrgAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW1gAAEA==": { seriesMasterId: "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xHzHrgAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW1gAAEA==", seriesTitle: "4D Wind Effect & Lift Coordination", granolaNoteId: "not_EFEU1ZY5XDaFph", granolaNoteTitle: "4D Wind Effect & Lift Coordination", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-14", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAAM5QuI6AAA=": { seriesMasterId: "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAAM5QuI6AAA=", seriesTitle: "Zoom - Level Up | KozPure re: weekly touch point", granolaNoteId: "not_o9Da8a6cjynzT4", granolaNoteTitle: "Zoom - Level Up | KozPure re: weekly touch point", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-08-19", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0gAAEA==": { seriesMasterId: "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0gAAEA==", seriesTitle: "NHS6 - Weekly M, E, P, LV, AV Coordination", granolaNoteId: "not_XFxVKiCz4DbJBb", granolaNoteTitle: "FW: NHS6 - Weekly M, E, P, LV, AV Coordination", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-15", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3w7OdREAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADRcQE9AAAEA==": { seriesMasterId: "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3w7OdREAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADRcQE9AAAEA==", seriesTitle: "DOVA | Weekly Civil Touch-Base", granolaNoteId: "not_qKk6oZ4sLF3PV2", granolaNoteTitle: "DOVA | Weekly Civil Touch-Base", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-10", hasEverHadNote: true },
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0wAAEA==": { seriesMasterId: "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwFRAAgI3xK8SSHAAEYAAAAADUhnIsMTPUKhilT7dZuqLgcAXEaksHNZ10WgvbPeW8d-UgAAAAABDQAAXEaksHNZ10WgvbPeW8d-UgADTSNW0wAAEA==", seriesTitle: "NHS6 - Weekly Enclosure Coordination", granolaNoteId: "not_s0IFaCJf6prfnn", granolaNoteTitle: "NHS6 - Weekly Enclosure Coordination", lastMatchedAt: "2026-09-16", noteMeetingDate: "2026-09-15", hasEverHadNote: true }
};

// Series that have NOT had notes but are known recurring
const NO_NOTE_SERIES = new Set([
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAAMO7LmWAAA=", // Boldyn
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAAMyJvrIAAA=", // Dova Arena Check-In
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bUAAA=", // NHS6 Structural
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bRAAA=", // NHS6 Civil
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bVAAA=", // NHS6 F&B
  "AAMkADg2YTYzOGYzLWIyNjUtNDdjNC1hMWFmLWRkNmI4Yzg0YzkxYwBGAAAAAAANSGciwxM9QqGKVPt1m6ouBwBcRqSwc1nXRaC9s95bx39SAAAAAAENAABcRqSwc1nXRaC9s95bx39SAANNI1bXAAA="  // NHS6 Code
]);

// ============================================================
// PROJECT RESOLUTION (Part 3 ladder)
// ============================================================

function resolveProject(subject) {
  const s = subject.toLowerCase();
  // Known project keywords
  if (s.includes('dova') || s.includes('cordova')) return { project: 'DOVA', rung: 1 };
  if (s.includes('mfp') || s.includes('miami freedom')) return { project: 'MFP', rung: 1 };
  if (s.includes('boldyn')) return { project: 'MFP', rung: 2 };  // Boldyn = MFP connectivity partner
  if (s.includes('kozpure') || s.includes('level up')) return { project: 'DOVA', rung: 2 }; // Most "Level Up | X" meetings are DOVA
  if (s.includes('nhs6')) return { project: 'Sphere', rung: 1 };
  if (s.includes('sphere')) return { project: 'Sphere', rung: 1 };
  if (s.includes('business') || s.includes('intro') || s.includes('l&s') || s.includes('jones')) return { project: 'Business', rung: 1 };
  return { project: 'Unassigned', rung: 0 };
}

// ============================================================
// GRANOLA API HELPERS
// ============================================================

async function fetchGranolaNotes() {
  const token = GRANOLA_TOKEN();
  if (!token) return [];
  try {
    // Fetch notes from last 30 days (paginated)
    let allNotes = [];
    let cursor = null;
    while (true) {
      const url = cursor 
        ? `${GRANOLA_API}/notes?page_size=30&cursor=${encodeURIComponent(cursor)}`
        : `${GRANOLA_API}/notes?page_size=30`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { console.error('Granola list error', res.status); break; }
      const data = await res.json();
      allNotes = allNotes.concat(data.notes || []);
      if (!data.hasMore) break;
      cursor = data.cursor;
      if (!cursor) break;
    }
    return allNotes;
  } catch (e) {
    console.error('Granola fetch error:', e.message);
    return [];
  }
}

async function fetchGranolaNoteDetail(noteId) {
  const token = GRANOLA_TOKEN();
  if (!token) return null;
  try {
    const url = `${GRANOLA_API}/notes/${noteId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ============================================================
// SERIES-BASED MATCHING
// ============================================================

// Build a map of seriesMasterId -> note info from the known map + detail fetch
async function buildSeriesMap() {
  // Return from in-memory cache if fresh
  if (_prepMap && (Date.now() - _mapCacheTime) < MAP_TTL) {
    return _prepMap;
  }

  // Start with the known map as base
  const map = { ...KNOWN_MAP };
  
  // Try to fetch fresh Granola notes and extend the map
  try {
    const notes = await fetchGranolaNotes();
    
    // Fetch details for notes that have calendar_event_id
    for (const n of notes) {
      if (n.calendar_event?.calendar_event_id) {
        // This note has a calendar_event_id on the LIST! (rare but possible)
        // Store by eventId for direct lookup
        const ceid = n.calendar_event.calendar_event_id;
        map['_byEventId_' + ceid] = { 
          noteId: n.id, 
          title: n.title,
          created: n.created_at
        };
      }
    }
  } catch (e) {
    // If map fetch fails, use KNOWN_MAP (from cron)
    console.error('Map build error (using fallback):', e.message);
  }
  
  _prepMap = map;
  _mapCacheTime = Date.now();
  return map;
}

// Match a calendar event to a series note using the seriesMasterId
function getNoteForSeries(seriesMasterId) {
  if (!seriesMasterId) return null;
  // Check exact match in known map
  if (KNOWN_MAP[seriesMasterId]) {
    const entry = KNOWN_MAP[seriesMasterId];
    return entry.hasEverHadNote ? {
      id: entry.granolaNoteId,
      title: entry.granolaNoteTitle,
      meetingDate: entry.noteMeetingDate,
      ageDays: entry.noteAgeDays,
      matchedBy: 'series'
    } : { noNote: true, neverHadNote: true };
  }
  // Check if this series has never had notes
  if (NO_NOTE_SERIES.has(seriesMasterId)) {
    return { noNote: true, neverHadNote: true };
  }
  return null; // Unknown series
}

// ============================================================
// TIME ZONE HELPERS
// ============================================================

// Convert Graph API UTC time to Eastern time display
function formatEventTime(dateTimeStr, includeEnd = false, endStr = null) {
  if (!dateTimeStr) return '';
  const start = new Date(dateTimeStr);
  const startET = start.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  if (includeEnd && endStr) {
    const end = new Date(endStr);
    const endET = end.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${startET} - ${endET} ET`;
  }
  return `${startET} ET`;
}

function formatEventDate(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  
  const dateStr = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  
  const dDate = d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const tDate = today.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const tmDate = tomorrow.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  
  if (dDate === tDate) return `Today, ${dateStr}`;
  if (dDate === tmDate) return `Tomorrow, ${dateStr}`;
  return dateStr;
}

// ============================================================
// PREP SECTIONS (for the full view)
// ============================================================

function buildPrepSections(event, seriesNote, tasks) {
  const sections = {};
  const now = new Date();
  const myName = 'Whitney Williams';
  
  // Open From Last Meeting: tracker items that predate this event
  const eventDate = new Date(event.start?.dateTime || event.start?.date);
  const openItems = (tasks || []).filter(t => {
    if (t.status === 'Complete' || t.status === 'Archived') return false;
    if (t.project !== event.project) return false;
    return true;
  });
  
  sections.openItems = openItems;
  
  // What I Owe: items where owner is Whitney
  sections.whatIOwe = openItems.filter(t => t.owner === myName);
  
  // Group by firm
  sections.byFirm = {};
  openItems.forEach(t => {
    const firm = t.responsibleFirm || 'Unassigned';
    if (!sections.byFirm[firm]) sections.byFirm[firm] = [];
    sections.byFirm[firm].push(t);
  });
  
  return sections;
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(req, res) {
  const { setCors, handleOptions, authenticateRequest } = await import('../lib/auth.js');
  
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;
  
  const fresh = await authenticateRequest(req, res, 'Calendars.Read Calendars.Read.Shared Calendars.ReadBasic');
  if (!fresh) return;
  
  try {
    // 1. Fetch calendar events with seriesMasterId
    const now = new Date().toISOString();
    const end = new Date(Date.now() + DAYS_AHEAD * 86400000).toISOString();
    
    const primaryUrl = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${encodeURIComponent(now)}&endDateTime=${encodeURIComponent(end)}&$select=subject,start,end,location,isAllDay,id,seriesMasterId,type&$top=50`;
    const primaryRes = await fetch(primaryUrl, {
      headers: { Authorization: `Bearer ${fresh.access_token}` }
    });
    
    let allEvents = [];
    if (primaryRes.ok) {
      const primaryData = await primaryRes.json();
      allEvents = (primaryData.value || []).map(e => ({
        subject: e.subject || '',
        start: e.start,
        end: e.end,
        location: e.location?.displayName || '',
        isAllDay: e.isAllDay || false,
        eventId: e.id || '',
        seriesMasterId: e.seriesMasterId || null,
        type: e.type || 'singleInstance',
        _fromPrimary: true
      }));
    }
    
    // Also fetch shared calendars
    try {
      const calListUrl = 'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,owner&$top=50';
      const calListRes = await fetch(calListUrl, {
        headers: { Authorization: `Bearer ${fresh.access_token}` }
      });
      
      if (calListRes.ok) {
        const calListData = await calListRes.json();
        const calendars = calListData.value || [];
        const sharedCals = calendars.filter(c => {
          const ownerEmail = c.owner?.name?.emailAddress?.address;
          return ownerEmail && ownerEmail !== fresh.email;
        });
        
        for (const cal of sharedCals) {
          try {
            const calUrl = `https://graph.microsoft.com/v1.0/me/calendars/${cal.id}/calendarview?startDateTime=${encodeURIComponent(now)}&endDateTime=${encodeURIComponent(end)}&$select=subject,start,end,location,isAllDay,id,seriesMasterId,type&$top=50`;
            const calRes = await fetch(calUrl, {
              headers: { Authorization: `Bearer ${fresh.access_token}` }
            });
            if (calRes.ok) {
              const calData = await calRes.json();
              const calEvents = (calData.value || []).map(e => ({
                subject: e.subject || '',
                start: e.start,
                end: e.end,
                location: e.location?.displayName || '',
                isAllDay: e.isAllDay || false,
                eventId: e.id || '',
                seriesMasterId: e.seriesMasterId || null,
                type: e.type || 'singleInstance',
                _calendarName: cal.name,
                _fromPrimary: false
              }));
              
              // Dedup by subject + start time
              const existingKeys = {};
              allEvents.forEach(e => {
                existingKeys[e.subject + '|' + (e.start?.dateTime || e.start?.date || '')] = true;
              });
              calEvents.forEach(e => {
                const key = e.subject + '|' + (e.start?.dateTime || e.start?.date || '');
                if (!existingKeys[key]) {
                  existingKeys[key] = true;
                  allEvents.push(e);
                }
              });
            }
          } catch (calErr) {
            console.error('Shared calendar fetch error:', cal.id, calErr.message);
          }
        }
      }
    } catch (e) {
      console.error('Calendar list error:', e.message);
    }
    
    // Sort by start time
    allEvents.sort((a, b) =>
      new Date(a.start?.dateTime || a.start?.date || 0) - new Date(b.start?.dateTime || b.start?.date || 0)
    );
    
    // 2. Build series map
    const seriesMap = await buildSeriesMap();
    
    // 3. Match each event to a series note
    const enrichedEvents = [];
    for (const event of allEvents) {
      // Resolve project
      const projectInfo = resolveProject(event.subject);
      
      // Check if this is Sphere — filter out (to be removed from widget)
      const project = projectInfo.project;
      
      // Match by series
      let noteInfo = null;
      let hasNote = false;
      let neverHadNote = false;
      let staleDays = null;
      
      if (event.seriesMasterId) {
        // Recurring event — match by series
        const result = getNoteForSeries(event.seriesMasterId);
        if (result) {
          if (result.noNote) {
            neverHadNote = result.neverHadNote || false;
          } else {
            noteInfo = result;
            hasNote = true;
            if (result.meetingDate) {
              staleDays = Math.round((Date.now() - new Date(result.meetingDate).getTime()) / 86400000);
            }
          }
        } else {
          // Unknown series — try Granola details
          // (fallback for series not in our known map)
        }
        // One-off events — noteInfo stays null, no note expected
      }
      
      // Fetch note detail if matched
      let noteDetail = null;
      let actionItems = [];
      let summaryPreview = '';
      let summaryMarkdown = '';
      
      if (hasNote && noteInfo && noteInfo.id) {
        noteDetail = await fetchGranolaNoteDetail(noteInfo.id);
        if (noteDetail) {
          summaryMarkdown = noteDetail.summary_markdown || '';
          summaryPreview = (noteDetail.summary_text || '').substring(0, 500);
          actionItems = extractActionItems(summaryMarkdown);
        }
      }
      
      enrichedEvents.push({
        subject: event.subject,
        start: event.start,
        end: event.end,
        location: event.location,
        isAllDay: event.isAllDay,
        calendarName: event._calendarName || '',
        seriesMasterId: event.seriesMasterId,
        isRecurring: !!event.seriesMasterId,
        project,
        project_rung: projectInfo.rung,
        // Time display (ET)
        timeET: formatEventTime(event.start?.dateTime || event.start?.date, true, event.end?.dateTime || event.end?.date),
        dateET: formatEventDate(event.start?.dateTime || event.start?.date),
        // Granola
        hasGranolaNote: hasNote,
        neverHadNote,
        granolaNoteId: noteInfo?.id || null,
        granolaNoteTitle: noteInfo?.title || null,
        granolaNoteDate: noteInfo?.meetingDate || null,
        granolaStaleDays: staleDays,
        granolaWebUrl: noteDetail?.web_url || null,
        summaryPreview,
        summaryMarkdown,
        actionItems
      });
    }
    
    res.json({ events: enrichedEvents });
  } catch (e) {
    console.error('Prep API error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// ============================================================
// EXTRACT ACTION ITEMS FROM GRANOLA MARKDOWN
// ============================================================

function extractActionItems(summaryMarkdown) {
  if (!summaryMarkdown) return [];
  const items = [];
  
  const lines = summaryMarkdown.split('\n');
  let inNextSteps = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('# Next Steps') || trimmed === '# Next Steps') {
      inNextSteps = true;
      continue;
    }
    
    if (inNextSteps && trimmed.startsWith('# ') && !trimmed.startsWith('# Next Steps')) {
      continue;
    }
    
    if (inNextSteps && trimmed.startsWith('- ')) {
      const boldPattern = /\*\*([^*]+)\*\*/g;
      let match;
      const assignees = [];
      while ((match = boldPattern.exec(trimmed)) !== null) {
        assignees.push(match[1]);
      }
      let actionText = trimmed.replace(/^- /, '').trim();
      actionText = actionText.replace(/\s*\([^)]*\)\s*$/, '').trim();
      
      items.push({
        assignees: assignees.length > 0 ? assignees : ['Unassigned'],
        text: actionText
      });
    }
  }
  
  if (items.length === 0) {
    const boldItemPattern = /- \*\*([^*]+)\*\*([^-]*)/g;
    let match;
    while ((match = boldItemPattern.exec(summaryMarkdown)) !== null) {
      const assignee = match[1].trim();
      const action = match[2].trim();
      if (action) {
        items.push({ assignees: [assignee], text: action });
      }
    }
  }
  
  return items;
}

export const config = { maxDuration: 30 };