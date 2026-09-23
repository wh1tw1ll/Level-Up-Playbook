// lib/handlers/prep-generate.js — POST /api/prep/generate
// Writes a Context Request row that triggers LUCI to generate an agenda
import { setCors, handleOptions } from '../auth.js';
import smartsheet from '../smartsheet.js';
const { addRow, updateColumn, getSheetWithColumns } = smartsheet;

const CONTEXT_SHEET_NAME = 'Context Requests';

let _sheetId = null;
let _colMap = null;

async function ensureSheet() {
  if (_sheetId && _colMap) return { sheetId: _sheetId, colMap: _colMap };
  const home = await smartsheet.getHome();
  const existing = (home.sheets || []).filter(s => s.name === CONTEXT_SHEET_NAME);
  if (existing.length === 0) throw new Error('Context Requests sheet not found. Run /api/admin/setup first.');
  _sheetId = existing[0].id;
  const sheet = await getSheetWithColumns(_sheetId);
  _colMap = {};
  for (const col of sheet.columns || []) {
    _colMap[col.title] = col.id;
  }
  // Ensure 'AgendaGeneration' is in the RequestType picklist options
  const reqTypeCol = (sheet.columns || []).find(c => c.title === 'RequestType');
  if (reqTypeCol && reqTypeCol.options) {
    const opts = reqTypeCol.options.map(o => typeof o === 'string' ? o : (o.name || ''));
    if (!opts.includes('AgendaGeneration')) {
      // Add it by updating the column
      await updateColumn(_sheetId, reqTypeCol.id, { options: [...opts, 'AgendaGeneration'] });
      _colMap = null; // force refresh on next call
      return ensureSheet();
    }
  }
  return { sheetId: _sheetId, colMap: _colMap };
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = req.body || {};
    const meetingSubject = body.meetingSubject || 'Unknown Meeting';
    const meetingTime = body.meetingTime || new Date().toISOString();
    const eventId = body.eventId || '';

    const info = await ensureSheet();
    const { sheetId, colMap } = info;

    const requestId = `agenda-${Date.now()}`;
    const question = `Generate agenda for: ${meetingSubject}\nTime: ${new Date(meetingTime).toLocaleString('en-US', { timeZone: 'America/New_York' })}\nEvent ID: ${eventId}\n\nReview Granola notes for this meeting, check related emails, and build a full meeting agenda. Include: key topics, open action items, relevant context from past meetings.`;

    await addRow(sheetId, [
      { columnId: colMap.RequestId, value: requestId },
      { columnId: colMap.RequestedAt, value: new Date().toISOString().split('T')[0] },
      { columnId: colMap.RequestType, value: 'AgendaGeneration' },
      { columnId: colMap.Scope, value: meetingSubject },
      { columnId: colMap.Question, value: question },
      { columnId: colMap.Status, value: 'Open' },
    ]);

    console.log(`Agenda request created: ${requestId} for "${meetingSubject}"`);

    return res.json({
      success: true,
      requestId,
      message: `Agenda request submitted for "${meetingSubject}". LUCI will generate it shortly.`,
      expectedLatency: 'up to 30 minutes (polled every 30m)',
    });

  } catch (err) {
    console.error('prep-generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}