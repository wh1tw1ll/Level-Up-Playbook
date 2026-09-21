// api/promote.js — Promote a staged item from Personal sheet to Project log
// Routes all writes through guarded-write.js; reads through smartsheet.js wrapper.

import smartsheet from '../smartsheet.js';
import guardedWrite from '../guarded-write.js';
import { makeKey, checkIdempotent } from '../idempotency.js';

const PROJECT_SHEET = '4456864287772548';
const PERSONAL_SHEET = '2802755367554948';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const rowId = body.rowId;
  if (!rowId) return res.status(400).json({ error: 'rowId required' });

  try {
    // Read personal row and both sheet structures (through smartsheet.js wrapper)
    const [rowData, projectSheet, personalSheet] = await Promise.all([
      smartsheet.getRow(PERSONAL_SHEET, rowId),
      smartsheet.getSheetWithColumns(PROJECT_SHEET),
      smartsheet.getSheetWithColumns(PERSONAL_SHEET),
    ]);

    if (!rowData) return res.status(404).json({ error: 'Row not found' });

    const projCols = projectSheet.columns || [];
    const persCols = personalSheet.columns || [];

    function getCellValue(title) {
      const col = persCols.find(c => c.title === title);
      if (!col) return null;
      const cell = (rowData.cells || []).find(c => c.columnId === col.id);
      return cell && cell.value !== undefined && cell.value !== null ? String(cell.value).trim() : null;
    }

    function getProjCol(title) {
      return projCols.find(col => col.title === title) || null;
    }

    // Read fields from personal row
    const text = getCellValue('Action ID');
    const owner = getCellValue('Owner');
    const status = getCellValue('Status');
    const dueDate = getCellValue('Due Date');
    const project = getCellValue('Project');
    const category = getCellValue('Category');
    const firm = getCellValue('Responsible Firm(s)');
    const sourceRef = getCellValue('SourceRef');
    const notes = getCellValue('Status Note');

    // Build columns for guardedWrite (write to Project sheet)
    const guardColumns = [];
    function addColumn(title, val) {
      if (!val) return;
      const col = getProjCol(title);
      if (!col) return;
      guardColumns.push({ title, columnId: col.id, type: col.type, value: val });
    }

    addColumn('Action ID', text);
    if (owner) addColumn('Owner', owner);
    if (status) addColumn('Status', status);
    if (dueDate) addColumn('Due Date', dueDate);
    if (project) addColumn('Project', project);
    if (category && category !== 'Staged') addColumn('Category', category);
    if (firm) addColumn('Responsible Firm(s)', firm);
    if (sourceRef) addColumn('SourceRef', sourceRef);
    if (notes) addColumn('Status Note', notes);

    // Idempotency check: compute key and check if row already exists
    const extractionKey = makeKey(sourceRef || text, text, dueDate || '');
    if (extractionKey) {
      const exists = await checkIdempotent(smartsheet, PROJECT_SHEET, extractionKey);
      if (exists) {
        return res.json({ status: 'duplicate', extractionKey, message: 'Row already exists (idempotent)' });
      }
      // Add extraction key to the columns being written
      const ekCol = getProjCol('ExtractionId');
      if (ekCol) {
        guardColumns.push({ title: 'ExtractionId', columnId: ekCol.id, type: ekCol.type || 'TEXT_NUMBER', value: extractionKey });
      }
    }

    if (guardColumns.length === 0) {
      return res.status(400).json({ error: 'No data to promote' });
    }

    // Write to project sheet through guardedWrite
    const writeResult = await guardedWrite({
      sheetId: PROJECT_SHEET,
      smartsheet,
      columns: guardColumns,
    });

    if (!writeResult.passed) {
      return res.status(422).json({
        error: 'Promote rejected by guard',
        reason: writeResult.reason,
      });
    }

    // Mark personal row as promoted (update Status and Source)
    const statusCol = persCols.find(c => c.title === 'Status');
    const sourceCol = persCols.find(c => c.title === 'Source');
    const updateColumns = [];

    if (statusCol) {
      updateColumns.push({ title: 'Status', columnId: statusCol.id, type: statusCol.type, value: 'Complete' });
    }
    if (sourceCol) {
      updateColumns.push({ title: 'Source', columnId: sourceCol.id, type: sourceCol.type, value: 'Manual' });
    }

    if (updateColumns.length > 0) {
      await guardedWrite({
        sheetId: PERSONAL_SHEET,
        smartsheet,
        existingRowId: rowId,
        columns: updateColumns,
      });
    }

    return res.json({
      status: 'Complete',
      projectRowId: writeResult.data?.result?.id || null,
    });
  } catch (err) {
    console.error('Promote error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };