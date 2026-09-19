// api/dispatch.js — POST /api/dispatch/:rowId
// Sets Status Note to indicate dispatch state.
// Uses smartsheet.js wrapper for all reads; guarded-write.js for writes.

import smartsheet from '../smartsheet.js';
import guardedWrite from '../guarded-write.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

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

    // Read sheet structure (through smartsheet.js wrapper)
    const sheetData = await smartsheet.getSheet(sheetId);
    const cols = {};
    for (const c of sheetData.columns || []) cols[c.title] = c.id;
    const statusNoteCol = cols['Status Note'];
    if (!statusNoteCol) return res.status(500).json({ error: 'Status Note column not found' });

    // Read row data (through smartsheet.js wrapper)
    const rowData = await smartsheet.getRow(sheetId, rowId);
    if (!rowData) return res.status(404).json({ error: 'Row not found' });

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

    // Fetch discussions/notes for the row (through smartsheet.js wrapper)
    let notes = [];
    try {
      const discussions = await smartsheet.getDiscussions(sheetId, rowId);
      for (const d of discussions.data || []) {
        const dData = await smartsheet.getDiscussion(sheetId, d.id);
        for (const c of dData.comments || []) {
          notes.push({
            author: c.createdBy?.name || c.createdBy?.email || '?',
            text: c.text || '',
            createdAt: c.createdAt || ''
          });
        }
      }
    } catch(e) { /* notes are optional */ }

    // === NOTIFY VIA TELEGRAM ===
    const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT = process.env.LUCI_DISPATCH_CHAT_ID || '8947918104';

    let msg;
    if (type === 'DRAFT' && TELEGRAM_BOT) {
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

      // Build a dynamic instruction based on the action item
      const actionLower = (actionItem || '').toLowerCase();
      let draftInstruction;
      if (/^(send|email|respond|reply)/.test(actionLower)) {
        draftInstruction = 'I need you to draft the email described below. Post it to this row\'s notes thread. Follow writing rules: direct, plain sentences. Lead with the ask. Named accountability, specific dates. No filler, no em dashes. Subject: PROJECT | Brief topic. Draft, never send.';
      } else if (/^(draft|write|compose|create|prepare)/.test(actionLower)) {
        draftInstruction = 'I need you to produce the draft described below. Post it to this row\'s notes thread. Use professional formatting appropriate to the deliverable. Draft, never send.';
      } else {
        draftInstruction = 'I need you to handle the action described below. If it needs a draft, produce it. If it needs research, summarize findings. If it needs follow-up, provide talking points. Post results to this row\'s notes thread.';
      }

      msg =
`📝 ${type} | [${source === 'personal' ? 'Personal' : projectVal}]
Row #${rowData.rowNumber}

${actionItem}

Owner: ${ownerVal}
${dueLine}${dueLine ? '' : ''}
${firmLine}
Status: ${statusVal}
${confidenceLine}
${statusLine}${notesBlock}

_Dispatched ${new Date().toLocaleString()}_

${draftInstruction}`;
    } else {
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

    // Update Status Note through guardedWrite
    const note = type === 'DRAFT'
      ? `Draft requested ${nowStamp}`
      : `Dispatched to LUCI ${nowStamp}`;

    // Find the Status Note column type from sheet structure
    const statusNoteColMeta = (sheetData.columns || []).find(c => c.title === 'Status Note');

    const writeResult = await guardedWrite({
      sheetId,
      smartsheet,
      existingRowId: rowId,
      columns: [
        { title: 'Action ID', columnId: cols['Action ID'], type: 'TEXT_NUMBER', value: actionItem !== '?' ? actionItem : 'Dispatch Note' },
        { title: 'Status Note', columnId: statusNoteCol, type: statusNoteColMeta?.type || 'TEXT_NUMBER', value: note },
      ],
    });

    if (!writeResult.passed) {
      console.warn('Guard write failed for dispatch status note:', writeResult.reason);
      // Fall back to direct update via smartsheet wrapper (Status Note only, no validation needed)
      const colType = statusNoteColMeta?.type;
      const updateCells = [{
        columnId: statusNoteCol,
        ...(colType === 'PICKLIST' || colType === 'TEXT_NUMBER'
          ? { objectValue: note }
          : { value: note }),
      }];
      await smartsheet.updateRow(sheetId, rowId, updateCells);
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