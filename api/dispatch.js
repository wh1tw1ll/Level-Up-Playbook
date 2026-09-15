// api/dispatch.js — POST /api/dispatch/:rowId
// Sends a task row to LUNA via Telegram Bot API
// Status line tracks: Dispatched -> (Working) -> Result ready / Failed

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.SMARTSHEET_TOKEN;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.LUCI_DISPATCH_CHAT_ID || '8947918104';

  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });
  if (!botToken) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rowId = pathParts[2];

    if (!rowId) return res.status(400).json({ error: 'Missing rowId in URL' });

    // Resolve sheet: personal or project
    const source = url.searchParams.get('source') || 'project';
    const sheetId = source === 'personal'
      ? '2802755367554948'
      : '4456864287772548';

    // Fetch row data from Smartsheet
    const sheetResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!sheetResp.ok) {
      return res.status(502).json({ error: 'Sheet fetch failed' });
    }
    const sheetData = await sheetResp.json();
    const cols = {};
    for (const c of sheetData.columns || []) cols[c.title] = c.id;

    // Find the specific row
    const row = (sheetData.rows || []).find(r => r.id == rowId);
    if (!row) return res.status(404).json({ error: 'Row not found' });

    function getCell(title) {
      const cell = (row.cells || []).find(c => c.columnId === cols[title]);
      if (!cell) return '';
      return cell.value !== undefined && cell.value !== null && cell.value !== ''
        ? String(cell.value)
        : (cell.displayValue || '');
    }

    const actionItem = getCell('Action ID');
    const owner = getCell('Owner');
    const status = getCell('Status');
    const project = getCell('Project');
    const category = getCell('Category');
    const dueDate = getCell('Due Date');
    const statusNote = getCell('Status Note');
    const sourceVal = source;

    // Fetch last 3 notes (comments) for context
    const notes = [];
    try {
      const discResp = await fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}/discussions`,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      if (discResp.ok) {
        const discData = await discResp.json();
        const discussions = discData.data || [];
        for (const d of discussions.slice(-1)) { // latest discussion only
          const commResp = await fetch(
            `https://api.smartsheet.com/2.0/sheets/${sheetId}/discussions/${d.id}`,
            { headers: { Authorization: 'Bearer ' + token } }
          );
          if (commResp.ok) {
            const commData = await commResp.json();
            const allComments = commData.comments || [];
            for (const c of allComments.slice(-3)) {
              notes.push({
                author: c.createdBy ? (c.createdBy.name || c.createdBy.email || '?') : '?',
                text: (c.text || '').slice(0, 500),
                createdAt: c.createdAt || ''
              });
            }
          }
        }
      }
    } catch { /* notes are optional */ }

    // Build Telegram message
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const msgParts = [
      `*Dispatch: ${project} / ${category || ''}*`,
      ``,
      `Row: ${row.id}  (${sourceVal}, sheet: ${sheetId})`,
      `Action: ${actionItem || '(no title)'}`,
      `Owner: ${owner || 'unassigned'}  |  Status: ${status || '?'}`,
      `Due: ${dueDate || 'none'}  |  Note: ${statusNote || 'none'}`,
      ``,
    ];

    if (notes.length > 0) {
      msgParts.push(`*Last notes:*`);
      for (const n of notes) {
        msgParts.push(`  ${n.author}: ${n.text.slice(0, 200)}`);
      }
      msgParts.push('');
    }

    msgParts.push(`_Dispatched: ${now}_`);

    // Send via Telegram Bot API
    const tgPayload = JSON.stringify({
      chat_id: chatId,
      text: msgParts.join('\n'),
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    const tgResp = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: tgPayload
      }
    );
    const tgResult = await tgResp.json();
    if (!tgResult.ok) {
      return res.status(502).json({
        error: 'Telegram send failed',
        detail: tgResult.description || 'unknown'
      });
    }

    // Mark Status Note as Dispatched
    const nowStamp = new Date().toISOString().slice(0, 16);
    const statusNoteCol = cols['Status Note'];
    if (statusNoteCol) {
      await fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cells: [{
              columnId: statusNoteCol,
              objectValue: `Dispatched to LUNA ${nowStamp}`
            }]
          })
        }
      );
    }

    res.json({
      success: true,
      dispatched: true,
      timestamp: now,
      telegramMessageId: tgResult.result?.message_id,
      rowId: row.id,
      sheetId
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };