// api/prep-map.js — Prep Map management
// ONE ROW PER RECURRING SERIES
// Columns: SeriesMasterId, SeriesTitle, GranolaNoteId, GranolaNoteTitle,
//          LastMatchedAt, NoteAgeDays, HasEverHadNote
// Cron builds the map; page-load reads it with 5-10 min TTL

import Smartsheet from '../smartsheet.js';

// Canonical Prep Map sheet (resolved by resolve-duplicates)
const PREP_MAP_ID = '1007659559112580';
const PREP_MAP_NAME = 'Prep Map';

async function getPrepMapSheetId() {
  // First try the known canonical ID — it's deterministic
  try {
    const sheet = await Smartsheet.getSheet(PREP_MAP_ID);
    if (sheet.name === PREP_MAP_NAME) return PREP_MAP_ID;
  } catch {}
  // Fallback: find by name (only after duplicates resolved)
  const home = await Smartsheet.getHome();
  const found = (home.sheets || []).filter(s => s.name === PREP_MAP_NAME);
  if (found.length === 1) return found[0].id;
  if (found.length > 1) throw new Error(`Duplicate Prep Map sheets: ${found.map(s=>s.id).join(', ')}`);
  // Don't auto-create — if the sheet is missing, it needs admin action
  throw new Error('Prep Map sheet not found. Run POST /api/admin/resolve-duplicates or create manually.');
}

// Columns discovered during sheet creation
const COLS = {
  SERIES_MASTER_ID: 2614711355015564,
  SERIES_TITLE: 7563393824689548,
  GRANOLA_NOTE_ID: 2683554610748588,
  GRANOLA_NOTE_TITLE: 2954106604701588,
  LAST_MATCHED_AT: 7061052361283468,
  NOTE_MEETING_DATE: 5211278733463180,
  NOTE_AGE_DAYS: 4006845097915532,
  HAS_EVER_HAD_NOTE: 8021330038560652
};

// In-memory cache with TTL
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  // Support CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: read the map (with TTL cache)
    if (req.method === 'GET') {
      if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) {
        return res.json({ map: _cache, cached: true, age: Math.round((Date.now() - _cacheTime) / 1000) + 's' });
      }

      const sheet = await Smartsheet.getSheet(await getPrepMapSheetId());
      const rows = sheet.rows || [];

      // Build a seriesMasterId -> row mapping
      const map = {};
      for (const r of rows) {
        const cells = r.cells || [];
        const getVal = (colId) => {
          const c = cells.find(c => c.columnId === colId);
          return c ? (c.value || c.displayValue || '') : '';
        };

        const sm = getVal(COLS.SERIES_MASTER_ID);
        if (!sm) continue;

        map[sm] = {
          seriesTitle: getVal(COLS.SERIES_TITLE),
          granolaNoteId: getVal(COLS.GRANOLA_NOTE_ID),
          granolaNoteTitle: getVal(COLS.GRANOLA_NOTE_TITLE),
          lastMatchedAt: getVal(COLS.LAST_MATCHED_AT),
          noteMeetingDate: getVal(COLS.NOTE_MEETING_DATE),
          noteAgeDays: getVal(COLS.NOTE_AGE_DAYS),
          hasEverHadNote: getVal(COLS.HAS_EVER_HAD_NOTE) === 'true' || getVal(COLS.HAS_EVER_HAD_NOTE) === true
        };
      }

      _cache = map;
      _cacheTime = Date.now();

      return res.json({ map, cached: false, rowCount: rows.length });
    }

    // POST: rebuild the map from current data
    if (req.method === 'POST') {
      const { series } = req.body;
      if (!series || !Array.isArray(series)) {
        return res.status(400).json({ error: 'series array required' });
      }

      // Clear existing rows
      const sheetId = await getPrepMapSheetId();
      const existing = await Smartsheet.getSheet(sheetId);
      const existingIds = (existing.rows || []).map(r => r.id);
      if (existingIds.length > 0) {
        await Smartsheet.deleteRows(sheetId, existingIds);
      }

      // Build new rows
      const rows = series.map(s => ({
        cells: [
          { columnId: COLS.SERIES_MASTER_ID, value: s.seriesMasterId },
          { columnId: COLS.SERIES_TITLE, value: s.seriesTitle },
          { columnId: COLS.GRANOLA_NOTE_ID, value: s.granolaNoteId || '' },
          { columnId: COLS.GRANOLA_NOTE_TITLE, value: s.granolaNoteTitle || '' },
          { columnId: COLS.LAST_MATCHED_AT, value: s.lastMatchedAt || '' },
          { columnId: COLS.NOTE_MEETING_DATE, value: s.noteMeetingDate || '' },
          { columnId: COLS.NOTE_AGE_DAYS, value: s.noteAgeDays !== undefined ? s.noteAgeDays : '' },
          { columnId: COLS.HAS_EVER_HAD_NOTE, value: s.hasEverHadNote || false }
        ]
      }));

      if (rows.length > 0) {
        await Smartsheet.addRows(sheetId, rows);
      }

      // Bust cache
      _cache = null;
      _cacheTime = 0;

      return res.json({ success: true, rowCount: rows.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Prep map error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

export const config = { maxDuration: 30 };