// api/stage.js — Stage a new action item to the Personal sheet
// Routes through guarded-write.js. No direct Smartsheet API calls.

import guardedWrite from '../guarded-write.js';
import smartsheet from '../smartsheet.js';

const PERSONAL_SHEET = '2802755367554948';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  try {
    // Get sheet structure (read-only — goes through smartsheet.js wrapper)
    const sheet = await smartsheet.getSheet(PERSONAL_SHEET);
    const columns = sheet.columns || [];

    function findCol(title) {
      return columns.find(c => c.title === title) || null;
    }

    // Build column array for guardedWrite
    const fieldMap = {
      'Action ID': body.text,
      'Owner': body.owner,
      'Status': body.status || 'Not Started',
      'Due Date': body.dueDate || null,
      'Project': body.project || null,
      'Category': body.category || 'Staged',
      'Responsible Firm(s)': body.firm || null,
      'SourceRef': body.sourceRef || null,
      'SeriesMasterId': body.seriesMasterId || null,
      'Confidence': body.confidence || 'high',
      'Source': body.source || 'Manual',
      'Status Note': body.notes || null,
    };

    const guardColumns = [];
    for (const [title, value] of Object.entries(fieldMap)) {
      if (value === null || value === undefined) continue;
      const col = findCol(title);
      if (!col) continue;
      guardColumns.push({
        columnId: col.id,
        type: col.type,
        value: String(value),
        title,
      });
    }

    if (guardColumns.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    // Write through guardedWrite
    const result = await guardedWrite({
      sheetId: PERSONAL_SHEET,
      smartsheet,
      columns: guardColumns,
    });

    if (!result.passed) {
      return res.status(422).json({
        error: 'Guard rejected',
        reason: result.reason,
      });
    }

    return res.json({
      status: 'staged',
      rowId: result.data?.result?.id || null,
      message: 'Item staged for review in Personal sheet',
    });
  } catch (e) {
    console.error('Stage error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

export const config = { maxDuration: 30 };