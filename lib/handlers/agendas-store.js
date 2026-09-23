// lib/handlers/agendas-store.js — Persistent agenda storage backed by Smartsheet
// Stores per-meeting agendas so they survive Vercel cold starts.
// Automatically creates the "LUCI - Agendas" sheet on first use.
import { setCors, handleOptions } from '../auth.js';
import smartsheet from '../smartsheet.js';
const { addRow, deleteRows } = smartsheet;

const AGENDAS_SHEET_NAME = 'LUCI - Agendas';

// Column structure for the Agendas sheet
const AGENDA_COLUMNS = [
  { title: 'MeetingSubject', type: 'TEXT_NUMBER', primary: true },
  { title: 'MeetingTime', type: 'TEXT_NUMBER' },
  { title: 'DurationMinutes', type: 'TEXT_NUMBER' },
  { title: 'HasPriorNotes', type: 'CHECKBOX' },
  { title: 'AgendaHtml', type: 'TEXT_NUMBER' },
  { title: 'GeneratedAt', type: 'TEXT_NUMBER' },
];

let _sheetId = null;
let _initialized = false;

async function ensureSheet() {
  if (_initialized && _sheetId) return _sheetId;
  try {
    // Check if sheet exists
    const home = await smartsheet.getHome();
    const existing = (home.sheets || []).filter(s => s.name === AGENDAS_SHEET_NAME);
    if (existing.length > 0) {
      _sheetId = existing[0].id;
    } else {
      // Create it
      const created = await smartsheet.createSheet(AGENDAS_SHEET_NAME, AGENDA_COLUMNS);
      _sheetId = created.result?.id;
      if (!_sheetId) throw new Error('Failed to create agendas sheet');
      console.log('Created LUCI - Agendas sheet:', _sheetId);
    }
    _initialized = true;
    return _sheetId;
  } catch (e) {
    console.error('ensureSheet error:', e.message);
    return null;
  }
}

async function getColumnMap() {
  const sid = await ensureSheet();
  if (!sid) return null;
  const sheet = await smartsheet.getSheetWithColumns(sid);
  const map = {};
  for (const col of sheet.columns || []) {
    map[col.title] = col.id;
  }
  return { sheetId: sid, columns: sheet.columns, colMap: map };
}

/** Fetch all stored agendas from Smartsheet */
export async function getStoredAgendas() {
  try {
    const info = await getColumnMap();
    if (!info) return [];
    const sheet = await smartsheet.getSheet(info.sheetId);
    if (!sheet.rows) return [];

    const { colMap } = info;
    const agendas = [];
    for (const row of sheet.rows || []) {
      const cells = {};
      for (const c of row.cells || []) {
        for (const [title, cid] of Object.entries(colMap)) {
          if (c.columnId === cid) {
            cells[title] = c.displayValue ?? (typeof c.value === 'string' ? c.value : '') ?? '';
          }
        }
      }
      if (!cells.MeetingSubject) continue;
      agendas.push({
        meetingSubject: cells.MeetingSubject,
        meetingTime: cells.MeetingTime || '',
        durationMinutes: parseInt(cells.DurationMinutes || '0', 10) || 0,
        hasPriorNotes: cells.HasPriorNotes === 'true' || cells.HasPriorNotes === true || cells.HasPriorNotes === '1',
        agendaHtml: cells.AgendaHtml || '',
        generatedAt: cells.GeneratedAt || '',
      });
    }
    return agendas;
  } catch (e) {
    console.error('getStoredAgendas error:', e.message);
    return [];
  }
}

/** Replace all stored agendas with a new set (clear + rewrite) */
export async function setStoredAgendas(agendas) {
  try {
    const info = await getColumnMap();
    if (!info) return false;
    const { sheetId, colMap } = info;

    // Delete all existing rows
    const existing = await smartsheet.getSheet(sheetId);
    if (existing.rows && existing.rows.length > 0) {
      const ids = existing.rows.map(r => r.id);
      await smartsheet.deleteRows(sheetId, ids);
    }

    // Add new rows (one at a time — no batch addRows in smartsheet.js)
    for (const ag of agendas) {
      const cells = [
        { columnId: colMap.MeetingSubject, value: ag.meetingSubject || '' },
        { columnId: colMap.MeetingTime, value: ag.meetingTime || '' },
        { columnId: colMap.DurationMinutes, value: String(ag.durationMinutes || 0) },
        { columnId: colMap.HasPriorNotes, value: ag.hasPriorNotes ? 'true' : 'false' },
        { columnId: colMap.AgendaHtml, value: ag.agendaHtml || '' },
        { columnId: colMap.GeneratedAt, value: ag.generatedAt || new Date().toISOString() },
      ];
      await addRow(sheetId, cells);
    }

    // Update in-memory cache
    _cachedAgendas = agendas;
    return true;
  } catch (e) {
    console.error('setStoredAgendas error:', e.message);
    return false;
  }
}

// In-memory cache for fast reads (refreshed on write)
let _cachedAgendas = null;
export function getCachedAgendas() {
  return _cachedAgendas;
}

// Legacy in-memory fallback for backward compatibility
let _legacyAgendas = [];

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method === 'POST') {
    const body = req.body || {};
    const agendas = body.agendas || [];
    const ok = await setStoredAgendas(agendas);
    return res.json({ ok, count: agendas.length });
  }

  if (req.method === 'GET') {
    const agendas = await getStoredAgendas();
    return res.json({ agendas });
  }

  // DELETE — clear all stored agendas
  if (req.method === 'DELETE') {
    try {
      const info = await getColumnMap();
      if (!info) return res.status(500).json({ error: 'No sheet' });
      const existing = await smartsheet.getSheet(info.sheetId);
      if (existing.rows && existing.rows.length > 0) {
        await smartsheet.deleteRows(info.sheetId, existing.rows.map(r => r.id));
      }
      return res.json({ ok: true, cleared: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'POST or GET only' });
}