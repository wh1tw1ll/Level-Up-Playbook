// api/dispatch.js — POST /api/dispatch/:rowId
// Sends the task to LUNA via Telegram, marks Status Note as dispatched.
// LUNA receives the message in our chat, processes, and posts back
// via POST /api/tasks/:rowId/notes.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ssToken = process.env.SMARTSHEET_TOKEN;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.LUCI_DISPATCH_CHAT_ID || '8947918104';

  if (!ssToken) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });
  if (!botToken) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rowId = pathParts[2];
    if (!rowId) return res.status(400).json({ error: 'Missing rowId in URL' });

    const source = url.searchParams.get('source') || 'project';
    const sheetId = source === 'personal'
      ? '2802755367554948'
      : '4456864287772548';

    // Fetch sheet
    const sheetResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
      { headers: { Authorization: 'Bearer ' + ssToken } }
    );
    if (!sheetResp.ok) return res.status(502).json({ error: 'Sheet fetch failed' });
    const sheetData = await sheetResp.json();
    const cols = {};
    for (const c of sheetData.columns || []) cols[c.title] = c.id;

    // Fetch row
    const rowResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      { headers: { Authorization: 'Bearer ' + ssToken } }
    );
    if (!rowResp.ok) return res.status(404).json({ error: 'Row not found' });
    const rowData = await rowResp.json();

    function getCell(title) {
      const cell = (rowData.cells || []).find(c => c.columnId === cols[title]);
      if (!cell) return '';
      const v = cell.value;
      return (v !== undefined && v !== null && v !== '') ? String(v) : (cell.displayValue || '');
    }

    const actionItem = getCell('Action ID');
    const owner = getCell('Owner');
    const status = getCell('Status');
    const project = getCell('Project');
    const category = getCell('Category');
    const dueDate = getCell('Due Date');
    const statusNote = getCell('Status Note');

    // Fetch last 3 notes for context
    const notes = [];
    try {
      const discResp = await fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}/discussions`,
        { headers: { Authorization: 'Bearer ' + ssToken } }
      );
      if (discResp.ok) {
        const discData = await discResp.json();
        for (const d of (discData.data || []).slice(-1)) {
          const cResp = await fetch(
            `https://api.smartsheet.com/2.0/sheets/${sheetId}/discussions/${d.id}`,
            { headers: { Authorization: 'Bearer ' + ssToken } }
          );
          if (cResp.ok) {
            const cData = await cResp.json();
            for (const c of (cData.comments || []).slice(-3)) {
              notes.push({
                author: c.createdBy ? (c.createdBy.name || c.createdBy.email || '?') : '?',
                text: (c.text || '').slice(0, 500),
                createdAt: c.createdAt || ''
              });
            }
          }
        }
      }
    } catch {}

    // Build Telegram message
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const msgParts = [
      `*Dispatch: ${project || '?'}${category ? ' / ' + category : ''}*`,
      '',
      `Row: ${rowData.id} (${source}, sheet: ${sheetId})`,
      `Action: ${actionItem || '(no title)'}`,
      `Owner: ${owner || 'unassigned'}  |  Status: ${status || '?'}`,
      `Due: ${dueDate || 'none'}`,
      '',
    ];

    if (notes.length > 0) {
      msgParts.push('*Last notes:*');
      for (const n of notes) {
        msgParts.push(`  ${n.author}: ${n.text.slice(0, 200)}`);
      }
      msgParts.push('');
    }

    msgParts.push(`_Dispatched: ${now}_`);
    msgParts.push('');
    msgParts.push('Tap the result link back to verify when LUNA posts output.');

    const tgPayload = JSON.stringify({
      chat_id: Number(chatId),
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
            Authorization: 'Bearer ' + ssToken,
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
      rowId: rowData.id,
      sheetId,
      telegramMessageId: tgResult.result?.message_id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };