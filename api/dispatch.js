// api/dispatch.js — POST /api/dispatch/:rowId
// Sets Status Note to 'Dispatched to LUNA {timestamp}' as a queue signal.
// LUNA polls for dispatched tasks, processes them, and posts results
// back via POST /api/tasks/:rowId/notes.
// No external dependencies — Status Note is the queue.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rowId = pathParts[2];
    if (!rowId) return res.status(400).json({ error: 'Missing rowId in URL' });

    const source = url.searchParams.get('source') || 'project';
    const sheetId = source === 'personal'
      ? '2802755367554948'
      : '4456864287772548';

    // Fetch sheet metadata
    const sheetResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!sheetResp.ok) return res.status(502).json({ error: 'Sheet fetch failed' });
    const sheetData = await sheetResp.json();

    const cols = {};
    for (const c of sheetData.columns || []) cols[c.title] = c.id;
    const statusNoteCol = cols['Status Note'];
    if (!statusNoteCol) return res.status(500).json({ error: 'Status Note column not found' });

    // Fetch row
    const rowResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!rowResp.ok) return res.status(404).json({ error: 'Row not found' });
    const rowData = await rowResp.json();

    // Extract cell values for context
    function getCell(title) {
      const cell = (rowData.cells || []).find(c => c.columnId === cols[title]);
      if (!cell) return '';
      return cell.value !== undefined && cell.value !== null && cell.value !== ''
        ? String(cell.value)
        : (cell.displayValue || '');
    }

    // Set Status Note to signal dispatch
    const nowStamp = new Date().toISOString().slice(0, 16);
    const note = `Dispatched to LUNA ${nowStamp}`;

    const updateResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cells: [{ columnId: statusNoteCol, objectValue: note }]
        })
      }
    );

    if (!updateResp.ok) {
      const err = await updateResp.text();
      return res.status(502).json({ error: 'Status Note update failed', detail: err });
    }

    res.json({
      success: true,
      dispatched: true,
      timestamp: nowStamp,
      rowId: rowData.id,
      sheetId,
      actionItem: getCell('Action ID'),
      project: getCell('Project'),
      owner: getCell('Owner'),
      status: getCell('Status')
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };