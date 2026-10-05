// api/stage.js — Stage action items to Personal or Project log through guarded-write.js
// Target: body.target = 'personal' (default) or 'project'
// Dry-run: body.dryRun = true (validation + dedup only, no write)

import guardedWrite from '../guarded-write.js';
import smartsheet from '../smartsheet.js';

const SHEETS = { personal: '2802755367554948', project: '4456864287772548' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const target = (body.target || 'personal').toLowerCase();
  const SHEET_ID = SHEETS[target];
  if (!SHEET_ID) return res.status(400).json({ error: `Unknown target: "${target}"` });

  try {
    const sheet = await smartsheet.getSheet(SHEET_ID);
    const columns = sheet.columns || [];
    const findCol = (title) => columns.find(c => c.title === title) || null;

    const fieldMap = {
      'Action ID': body.text, 'Owner': body.owner,
      'Status': body.status || 'Open', 'Due Date': body.dueDate || null,
      'Project': body.project || null,
      'Category': body.category || 'General Coordination',
      'Responsible Firm(s)': body.firm || null,
      'SourceRef': body.sourceRef || null,
      'SeriesMasterId': body.seriesMasterId || null,
      'Confidence': body.confidence || 'Medium',
      'Source': body.source || 'Manual',
      'Status Note': body.notes || null,
      'Meeting Source': body.meeting || body.meetingSource || null,
      'ExtractionId': body.extractionId || null,
      'Hot Topic': body.hotTopic || null,
    };

    const guardColumns = [];
    for (const [title, value] of Object.entries(fieldMap)) {
      if (value === null || value === undefined) continue;
      const col = findCol(title);
      if (!col) continue;
      guardColumns.push({ columnId: col.id, type: col.type, value: String(value), title });
    }

    if (guardColumns.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

    // Dry-run mode (no write)
    if (body.dryRun) {
      const dedup = await guardedWrite({
        sheetId: SHEET_ID, smartsheet, columns: guardColumns,
        extractionId: body.extractionId || null,
      });
      if (dedup.passed) return res.json({ dryRun: true, verdict: 'new' });
      return res.json({ dryRun: true, verdict: 'skip', reason: dedup.reason, matchType: dedup.data?.matchType });
    }

    const result = await guardedWrite({
      sheetId: SHEET_ID, smartsheet, columns: guardColumns,
      extractionId: body.extractionId || null,
    });

    if (!result.passed) return res.status(422).json({ error: 'Guard rejected', reason: result.reason });

    return res.json({ status: 'staged', rowId: result.data?.result?.id || null, message: `Staged to ${target} log`, target });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

export const config = { maxDuration: 30 };