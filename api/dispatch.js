// api/dispatch.js — POST /api/dispatch/:rowId
// Sets Status Note to 'Dispatched to LUCI'. LUCI (this Hermes agent)
// picks up dispatched tasks and posts results back through chat.

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
    const note = `Dispatched to LUCI ${nowStamp}`;

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

    // === TRUE TRIGGER: Notify LUNA via Telegram ===
    const TELEGRAM_BOT = process.env.LUNA_TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT = process.env.LUNA_TELEGRAM_CHAT_ID;
    if (TELEGRAM_BOT && TELEGRAM_CHAT) {
      // Build a message with the dispatched task
      const actVal = rowData.cells?.find(c => c.columnId === cols['Action ID']);
      const projVal = rowData.cells?.find(c => c.columnId === cols['Project']);
      const ownerVal = rowData.cells?.find(c => c.columnId === cols['Owner']);
      const dueVal = rowData.cells?.find(c => c.columnId === cols['Due Date']);
      const firmVal = rowData.cells?.find(c => c.columnId === cols['Responsible Firm(s)']);
      const catVal = rowData.cells?.find(c => c.columnId === cols['Category']);

      const msg =
`⚡ *DISPATCHED TO LUNA*
Row #${rowData.rowNumber} | [${projVal?.displayValue || projVal?.value || '?'}]

*${actVal?.displayValue || actVal?.value || '?'}*

Owner: ${ownerVal?.displayValue || ownerVal?.value || '?'}
Due: ${dueVal?.displayValue || dueVal?.value || 'TBD'}
Firm: ${firmVal?.displayValue || firmVal?.value || '?'}
Category: ${catVal?.displayValue || catVal?.value || '?'}
Status: ${rowData.cells?.find(c => c.columnId === cols['Status'])?.displayValue || '?'}

_Dispatched ${new Date().toLocaleString()}_`;

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT,
          text: msg,
          parse_mode: 'Markdown'
        })
      });
    }

    res.json({ success: true, dispatched: true, timestamp: nowStamp, rowId: rowData.id, sheetId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };