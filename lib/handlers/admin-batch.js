// lib/handlers/admin-batch.js
// POST /api/admin/batch — minimal batch operations for DOVA tracker cleanup
// Auth is handled by the calling route (auth guard in api/index.js)

import smartsheet from '../smartsheet.js';

const DOVA_SHEET = '4456864287772548';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, data } = req.body || {};

  switch (action) {

    case 'delete-rows': {
      if (!data || !Array.isArray(data.rowIds) || data.rowIds.length === 0) {
        return res.status(400).json({ error: 'Requires data.rowIds array' });
      }
      try {
        const result = await smartsheet.deleteRows(DOVA_SHEET, data.rowIds);
        return res.json({ action: 'delete-rows', deleted: data.rowIds.length, result: result.message || 'ok' });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    case 'set-project': {
      if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
        return res.status(400).json({ error: 'Requires data.rows array' });
      }
      const sheet = await smartsheet.getSheetWithColumns(DOVA_SHEET);
      const projCol = (sheet.columns || []).find(c => c.title === 'Project');
      if (!projCol) return res.status(500).json({ error: 'Project column not found' });

      const batch = data.rows.map(r => ({
        id: r.rowId,
        cells: [{ columnId: projCol.id, value: r.project || 'DOVA' }]
      }));

      try {
        await smartsheet.updateRows(DOVA_SHEET, batch);
        return res.json({
          action: 'set-project',
          updated: batch.length,
          rows: data.rows.map(r => ({ rowId: r.rowId, project: r.project || 'DOVA' }))
        });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}. Supported: delete-rows, set-project` });
  }
}