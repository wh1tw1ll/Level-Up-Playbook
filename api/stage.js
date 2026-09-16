// api/stage.js — Stage a new action item to the Personal sheet (pending review)
// Prevents direct writes to the Project log (Rule 4 enforcement)
// Stage = write to Personal sheet with Confidence="medium", source="staged"
// Later: Promote UI moves staged items to Project log after Whitney approves

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });

  const PERSONAL_SHEET = '2802755367554948';

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Get sheet columns for column ID mapping
  const sheetResp = await fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!sheetResp.ok) {
    return res.status(502).json({ error: 'Failed to fetch sheet schema' });
  }
  const sheet = await sheetResp.json();
  const columns = sheet.columns || [];

  function findColumnId(title) {
    const c = columns.find(col => col.title === title);
    return c ? c.id : null;
  }

  // Build cells
  const cells = [];

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
    'Confidence': body.confidence || 'medium',
    'Source': 'staged',
    'Status Note': body.notes || null
  };

  for (const [title, value] of Object.entries(fieldMap)) {
    if (value === null || value === undefined) continue;
    const colId = findColumnId(title);
    if (!colId) continue;
    cells.push({ columnId: colId, value: String(value) });
  }

  if (cells.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  // Write to Personal sheet
  const writeResp = await fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}/rows`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      cells: cells,
      toBottom: true
    })
  });

  const writeData = await writeResp.json();

  if (!writeResp.ok) {
    return res.status(502).json({ error: 'Failed to stage item', detail: writeData });
  }

  return res.json({
    status: 'staged',
    rowId: writeData.result?.id || null,
    message: 'Item staged for review in Personal sheet',
    fields: cells.length
  });
}

export const config = { maxDuration: 30 };
