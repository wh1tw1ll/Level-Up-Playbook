// api/dispatch.js — POST /api/dispatch/:rowId
// Sets Status Note to indicate dispatch state.
// Handles DRAFT type: sends rich draft request context to Telegram.
// Handles TRACK/DO: current behavior.

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
    const type = url.searchParams.get('type') || 'DO';
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

    // Helper: get cell value by column title
    function getCell(title) {
      const c = rowData.cells?.find(cell => cell.columnId === cols[title]);
      return c?.displayValue || c?.value || null;
    }

    const actionItem = getCell('Action ID') || '?';
    const projectVal = getCell('Project') || '?';
    const ownerVal = getCell('Owner') || 'Unassigned';
    const dueVal = getCell('Due Date') || null;
    const firmVal = getCell('Responsible Firm(s)') || null;
    const statusVal = getCell('Status') || '?';
    const statusNote = getCell('Status Note') || '';
    const confidence = getCell('Confidence') || '';

    // Fetch discussions/notes for the row
    let notes = [];
    try {
      const discResp = await fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}/discussions`,
        { headers: { Authorization: 'Bearer ' + ssToken } }
      );
      if (discResp.ok) {
        const discData = await discResp.json();
        const discussions = discData.data || [];
        for (const d of discussions) {
          const dResp = await fetch(
            `https://api.smartsheet.com/2.0/sheets/${sheetId}/discussions/${d.id}`,
            { headers: { Authorization: 'Bearer ' + ssToken } }
          );
          if (dResp.ok) {
            const dData = await dResp.json();
            for (const c of dData.comments || []) {
              notes.push({
                author: c.createdBy?.name || c.createdBy?.email || '?',
                text: c.text || '',
                createdAt: c.createdAt || ''
              });
            }
          }
        }
      }
    } catch(e) { /* notes are optional */ }

    // === NOTIFY VIA TELEGRAM ===
    const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT = process.env.LUCI_DISPATCH_CHAT_ID || '8947918104';

    let msg;
    if (type === 'DRAFT' && TELEGRAM_BOT) {
      // Format as draft request with full context
      const dueLine = dueVal ? `Due: ${dueVal}` : '';
      const firmLine = firmVal ? `Firm: ${firmVal}` : '';
      const statusLine = statusNote ? `Status note: ${statusNote}` : '';
      const confidenceLine = confidence ? `Confidence: ${confidence}` : '';

      let notesBlock = '';
      if (notes.length > 0) {
        notesBlock = '\n\nNotes:';
        for (const n of notes) {
          notesBlock += `\n[${n.author}]: ${n.text.substring(0, 300)}`;
        }
      }

      msg =
`📝 DRAFT REQUEST | ${type} | [${source === 'personal' ? 'Personal' : projectVal}]
Row #${rowData.rowNumber}

${actionItem}

Owner: ${ownerVal}
${dueLine}${dueLine ? '' : ''}
${firmLine}
Status: ${statusVal}
${confidenceLine}
${statusLine}${notesBlock}

_Dispatched ${new Date().toLocaleString()}_

I need: an email draft posted to this row's notes thread. Follow writing rules:
- Direct, plain sentences. Lead with the ask.
- Named accountability, specific dates
- No filler, no em dashes
- Subject: PROJECT | Brief topic
- Draft, never send`;
    } else {
      // Current behavior for TRACK/DO
      msg =
`⚡ ${type === 'TRACK' ? 'TRACK' : 'DISPATCHED'} | [${source === 'personal' ? 'Personal' : projectVal}]
Row #${rowData.rowNumber}

${actionItem}

Owner: ${ownerVal}
Due: ${dueVal || 'TBD'}
Firm: ${firmVal || '?'}
Category: ${getCell('Category') || '?'}
Status: ${statusVal}

_Dispatched ${new Date().toLocaleString()}_`;
    }

    // Update Status Note
    const note = type === 'DRAFT'
      ? `Draft requested ${nowStamp}`
      : `Dispatched to LUCI ${nowStamp}`;

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

    if (TELEGRAM_BOT) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT,
          text: msg,
          parse_mode: 'Markdown'
        })
      }).catch(() => {});
    }

    res.json({ success: true, dispatched: true, timestamp: nowStamp, rowId: rowData.id, sheetId, type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };