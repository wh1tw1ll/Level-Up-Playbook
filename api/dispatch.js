// api/dispatch.js — POST /api/dispatch/:rowId
// Sets Status Note to 'Dispatched to LUNA'. That is the trigger.
// No Telegram, no bot tokens, no external dependencies.
// LUNA picks up dispatched tasks via cron and posts results
// back through the notes thread.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ssToken = process.env.SMARTSHEET_TOKEN;
  if (!ssToken) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rowId = pathParts[2];
    if (!rowId) return res.status(400).json({ error: 'Missing rowId in URL' });

    const source = url.searchParams.get('source') || 'project';
    const sheetId = source === 'personal'
      ? '2802755367554948'
      : '4456864287772548';

    const sheetResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
      { headers: { Authorization: 'Bearer ' + ssToken } }
    );
    if (!sheetResp.ok) return res.status(502).json({ error: 'Sheet fetch failed' });
    const sheetData = await sheetResp.json();

    const cols = {};
    for (const c of sheetData.columns || []) cols[c.title] = c.id;
    const statusNoteCol = cols['Status Note'];
    if (!statusNoteCol) return res.status(500).json({ error: 'Status Note column not found' });

    const rowResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      { headers: { Authorization: 'Bearer ' + ssToken } }
    );
    if (!rowResp.ok) return res.status(404).json({ error: 'Row not found' });
    const rowData = await rowResp.json();

    const nowStamp = new Date().toISOString().slice(0, 16);
    const note = `Dispatched to LUNA ${nowStamp}`;

    const updateResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + ssToken,
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

    res.json({ success: true, dispatched: true, timestamp: nowStamp, rowId: rowData.id, sheetId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };