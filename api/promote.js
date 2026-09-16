// api/promote.js — Promote a staged item from Personal sheet to Project log
// Reads the personal row, copies its data to the project sheet, updates confidence

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });

  const PROJECT_SHEET = '4456864287772548';
  const PERSONAL_SHEET = '2802755367554948';

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const rowId = body.rowId;
  if (!rowId) return res.status(400).json({ error: 'rowId required' });

  // Fetch the personal row
  const rowResp = await fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}/rows/${rowId}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!rowResp.ok) {
    return res.status(404).json({ error: 'Row not found in Personal sheet' });
  }
  const rowData = await rowResp.json();

  // Get column mappings for both sheets
  const [projectSheet, personalSheet] = await Promise.all([
    fetch(`https://api.smartsheet.com/2.0/sheets/${PROJECT_SHEET}`, {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json()),
    fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}`, {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json())
  ]);

  const projectCols = projectSheet.columns || [];
  const personalCols = personalSheet.columns || [];

  function findColId(cols, title) {
    const c = cols.find(col => col.title === title);
    return c ? c.id : null;
  }

  // Map personal cell values to project column IDs with type-aware formatting
  const cells = [];
  const personalCells = rowData.cells || [];

  // Build column type lookup
  const personalColType = {};
  const projectColType = {};
  for (const c of personalCols) personalColType[c.id] = c.type;
  for (const c of projectCols) projectColType[c.id] = c.type;

  for (const cell of personalCells) {
    const col = personalCols.find(c => c.id === cell.columnId);
    if (!col) continue;
    if (col.title === 'Confidence' || col.title === 'Source' || col.title === 'LinkedRowId') continue;
    const projectCol = projectCols.find(c => c.title === col.title);
    if (!projectCol) continue;
    const projectColId = projectCol.id;
    const val = cell.value !== undefined && cell.value !== null ? cell.value : null;
    if (val === null || val === '') continue;

    const pType = projectCol.type;
    const cellObj = { columnId: projectColId };

    if (pType === 'CONTACT_LIST') {
      cellObj.objectValue = { name: String(val) };
    } else if (pType === 'DATE') {
      cellObj.value = String(val);
    } else if (pType === 'PICKLIST' || pType === 'MULTI_PICKLIST') {
      cellObj.objectValue = { value: String(val) };
    } else if (pType === 'CHECKBOX') {
      cellObj.value = val === true || val === 'true' || val === '1' || val === 'Yes';
    } else if (pType === 'DURATION' || pType === 'PREDECESSOR') {
      cellObj.value = String(val);
    } else {
      cellObj.value = String(val);
    }
    cells.push({ column: col.title, type: pType, ...cellObj });
  }

  // Remove SeriesMasterId from cells
  const smIdx = cells.findIndex(c => c.column === 'SeriesMasterId');
  if (smIdx >= 0) cells.splice(smIdx, 1);

  // Strip debug info and build clean cell array
  const cleanCells = cells.map(c => {
    const cell = { columnId: c.columnId };
    if (c.objectValue !== undefined) cell.objectValue = c.objectValue;
    else if (c.value !== undefined) cell.value = c.value;
    return cell;
  });

  if (cleanCells.length === 0) {
    return res.status(400).json({ error: 'No valid data to promote' });
  }

  // Write to project sheet
  const writeResp = await fetch(`https://api.smartsheet.com/2.0/sheets/${PROJECT_SHEET}/rows`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cells: cleanCells, toBottom: true })
  });

  const writeData = await writeResp.json();
  if (!writeResp.ok) {
    return res.status(502).json({
      error: 'Failed to promote',
      detail: writeData,
      cellDebug: cells.map(c => ({ column: c.column, type: c.type, value: c.value, objectValue: c.objectValue }))
    });
  }

  // Update personal row status to "Complete" (promoted)
  const statusColId = findColId(personalCols, 'Status');
  const sourceColId = findColId(personalCols, 'Source');
  const updateCells = [];
  if (statusColId) updateCells.push({ columnId: statusColId, value: 'Complete' });
  if (sourceColId) updateCells.push({ columnId: sourceColId, value: 'promoted' });

  if (updateCells.length > 0) {
    await fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}/rows/${rowId}`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cells: updateCells })
    });
  }

  return res.json({
    status: 'promoted',
    projectRowId: writeData.result?.id || null,
    personalRowId: rowId
  });
}

export const config = { maxDuration: 30 };