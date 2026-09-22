// lib/handlers/prep.js — Prep API endpoint
// Serves meeting notes from Granola + grouped action items from Smartsheet
import { setCors, handleOptions } from '../auth.js';
import { getStoredAgendas } from './agendas-store.js';

const GRANOLA_API = 'https://public-api.granola.ai/v1';
const GRANOLA_TOKEN = 'grn_Xt3QX2jolKxe3tEGXUeL4QiH_DQwZXXZvbetD39O12j2PevnIBvXFgH6UZMphuXM6sUrP';

const SMARTSHEET_API = 'https://api.smartsheet.com/2.0';
const SHEET_ID = '4456864287772548';

// Smartsheet column IDs
const COLUMNS = {
  ACTION_ID: 6748787438817156,
  STATUS: 2258381950979972,
  OWNER: 9000587252502404,
  HOT_TOPIC: 1193738206744452,
};

// ── HELPERS ──

/** Parse Action ID like "[Granola: DOVA | SD Phase Coordination (2026-09-10)] Do X..." */
function parseActionId(actionId) {
  if (!actionId) return null;
  const match = actionId.match(/^\[Granola:\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\)\]\s*(.*)$/);
  if (!match) return null;
  return {
    meetingName: match[1].trim(),
    meetingDate: match[2],
    actionText: match[3].trim(),
  };
}

/** Get the Smartsheet authorization token */
function getSmartsheetToken() {
  return process.env.SMARTSHEET_TOKEN || 'ChRJVBkqJEaha5mLiDYGn3WCzE79I9yNkmEID';
}

/** Fetch sheet data from Smartsheet REST API */
async function fetchSmartsheetSheet() {
  const url = `${SMARTSHEET_API}/sheets/${SHEET_ID}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getSmartsheetToken()}` },
  });
  if (!res.ok) {
    throw new Error(`Smartsheet API returned ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

/** Get cell value from a row by column ID */
function getCellValue(row, colId) {
  const cell = (row.cells || []).find(c => String(c.columnId) === String(colId));
  if (!cell) return '';
  return cell.displayValue ?? (typeof cell.value === 'string' ? cell.value : '');
}

/** Fetch recent notes from Granola API (last 14 days) */
async function fetchGranolaNotes() {
  try {
    console.log('Fetching Granola notes...');
    const url = `${GRANOLA_API}/notes?page_size=30`;
    console.log('Granola URL:', url);
    const res = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${GRANOLA_TOKEN}`,
        'User-Agent': 'LUCI-App/1.0',
        'Accept': 'application/json',
      },
    });
    console.log('Granola response status:', res.status);
    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      console.error('Granola fetch failed:', res.status, errText.substring(0, 200));
      return [];
    }
    const data = await res.json();
    console.log('Granola notes received:', (data.notes || []).length);
    const cutoff = new Date(Date.now() - 14 * 86400000);
    const notes = (data.notes || []).filter(n => new Date(n.created_at || 0) >= cutoff);
    console.log('Granola notes after date filter:', notes.length);
    return notes;
  } catch (err) {
    console.error('Granola fetch error:', err.message);
    return [];
  }
}

// ── MAIN HANDLER ──

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  try {
    // Fetch data from both APIs in parallel
    const [granolaNotes, sheetData] = await Promise.all([
      fetchGranolaNotes(),
      fetchSmartsheetSheet(),
    ]);

    // Build column lookup
    const colMap = {};
    for (const col of sheetData.columns || []) {
      colMap[col.title] = col.id;
    }

    // Process Smartsheet rows into action items grouped by meeting
        const meetingActionMap = {}; // key: `${meetingName}::${meetingDate}` -> actions[]
        const allActions = []; // all open actions
        const generalActions = []; // non-prefixed open actions

        for (const row of sheetData.rows || []) {
          const actionId = getCellValue(row, COLUMNS.ACTION_ID);
      
          const status = getCellValue(row, COLUMNS.STATUS);
          // Skip completed/closed items
          if (['Complete', 'Archived', 'Closed'].includes(status)) continue;
      
          const parsed = parseActionId(actionId);
      
          const actionItem = {
            actionText: parsed ? parsed.actionText : (actionId || ''),
            rawActionId: actionId || '',
            status,
            owner: getCellValue(row, COLUMNS.OWNER) || 'Unassigned',
            hotTopic: getCellValue(row, COLUMNS.HOT_TOPIC) === 'true' || getCellValue(row, COLUMNS.HOT_TOPIC) === true,
            rowId: row.id,
          };
      
          if (!actionItem.actionText && !actionItem.rawActionId) continue;
      
          allActions.push(actionItem);
      
          if (parsed) {
            const key = `${parsed.meetingName}::${parsed.meetingDate}`;
            if (!meetingActionMap[key]) meetingActionMap[key] = [];
            meetingActionMap[key].push(actionItem);
          } else {
            generalActions.push(actionItem);
          }
        }

    // Build meetings array from Granola notes, enriched with matched action items
    const meetings = [];

    for (const note of granolaNotes) {
      const title = note.title || note.calendar_event?.subject || 'Untitled Meeting';
      const date = note.created_at || note.calendar_event?.start_time || '';
      const rawSummary = note.summary_markdown || note.summary_text || '';
      const summary = rawSummary.length > 500 ? rawSummary.substring(0, 500) + '…' : rawSummary;
      const webUrl = note.web_url || '';

      // Try to match Granola note to Smartsheet actions by meeting name
      // Normalize: extract the part after "Granola: " and before the date
      // Granola notes have titles like "DOVA | SD Phase Coordination"
      const noteDate = date ? new Date(date).toISOString().split('T')[0] : '';
      let matchedActions = [];

      // Try matching by title AND date first
      const exactKey = `${title}::${noteDate}`;
      if (meetingActionMap[exactKey]) {
        matchedActions = meetingActionMap[exactKey];
      } else {
        // Fallback: match by date only, then filter by title similarity
        const allKeys = Object.keys(meetingActionMap);
        for (const key of allKeys) {
          const [meetingName, meetingDate] = key.split('::');
          if (meetingDate === noteDate && meetingName.toLowerCase().includes(title.toLowerCase())) {
            matchedActions = meetingActionMap[key];
            break;
          }
        }
      }

      meetings.push({
        title,
        date,
        summary,
        web_url: webUrl,
        actions: matchedActions,
      });
    }

    // Sort meetings by date (newest first)
    meetings.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // ── Build 48-hour agenda ──
    // Upcoming actions (all open items not yet grouped into recent meetings),
    // sorted by Hot Topic first, then by Owner alphabetically
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Get all unique open actions that weren't matched to recent meetings
    const matchedSet = new Set();
    for (const m of meetings) {
      for (const a of m.actions) {
        matchedSet.add(a.rowId);
      }
    }

    const unmatchedActions = allActions.filter(a => !matchedSet.has(a.rowId));

    const agenda = {
      generatedAt: now.toISOString(),
      horizonHours: 48,
      totalActions: allActions.length,
      recentMatched: meetings.reduce((sum, m) => sum + m.actions.length, 0),
      upcomingUnmatched: unmatchedActions.length,
      // Top priority: hot topics first, then sorted by owner
      upcomingActions: unmatchedActions
        .sort((a, b) => {
          // Hot Topic first
          if (a.hotTopic !== b.hotTopic) return a.hotTopic ? -1 : 1;
          // Then by owner alphabetically
          return (a.owner || '').localeCompare(b.owner || '');
        })
        .slice(0, 50), // Cap at 50
    };

    return res.json({
      meetings,
      agenda,
      perMeetingAgendas: getStoredAgendas(),
    });
  } catch (err) {
    console.error('Prep handler error:', err.message);
    return res.status(500).json({ error: err.message, stack: err.stack?.substring(0, 500) });
  }
}