// lib/handlers/agenda-update.js — PUT /api/prep/agenda/update
// Updates the agendaHtml for a specific meeting in the LUCI - Agendas sheet
import { setCors, handleOptions } from '../auth.js';
import smartsheet from '../smartsheet.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'PUT') return res.status(405).json({ error: 'POST or PUT only' });

  try {
    const body = req.body || {};
    const meetingSubject = body.meetingSubject || '';
    const agendaHtml = body.agendaHtml || '';
    if (!meetingSubject) return res.status(400).json({ error: 'meetingSubject required' });

    const AGENDAS_SHEET_NAME = 'LUCI - Agendas';
    const home = await smartsheet.getHome();
    const existing = (home.sheets || []).filter(s => s.name === AGENDAS_SHEET_NAME);
    if (existing.length === 0) return res.status(404).json({ error: 'Agendas sheet not found' });

    const sheetId = existing[0].id;
    const sheet = await smartsheet.getSheetWithColumns(sheetId);

    // Find column IDs
    const colMap = {};
    for (const col of sheet.columns || []) {
      colMap[col.title] = col.id;
    }

    if (!colMap.MeetingSubject || !colMap.AgendaHtml) {
      return res.status(500).json({ error: 'Required columns not found' });
    }

    // Find the matching row by meeting subject (fuzzy match)
    const subjKey = meetingSubject.toLowerCase().trim();
    let targetRow = null;
    for (const row of sheet.rows || []) {
      for (const c of row.cells || []) {
        if (c.columnId === colMap.MeetingSubject) {
          const v = String(c.displayValue || c.value || '').toLowerCase().trim();
          if (v === subjKey || v.includes(subjKey) || subjKey.includes(v)) {
            targetRow = row;
            break;
          }
        }
      }
      if (targetRow) break;
    }

    if (!targetRow) return res.status(404).json({ error: 'Meeting not found in agendas sheet' });

    // Update the AgendaHtml cell
    await smartsheet.updateRow(sheetId, targetRow.id, [
      { columnId: colMap.AgendaHtml, value: agendaHtml },
    ]);

    return res.json({
      success: true,
      meetingSubject,
      updated: true,
    });

  } catch (err) {
    console.error('agenda-update error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}