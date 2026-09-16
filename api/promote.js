// api/promote.js — Promote a staged item from Personal sheet to Project log
// Simplified: writes explicit tracked fields with proper type handling

const OWNER_EMAIL = 'wwilliams@levelup-pd.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });

  const PROJECT_SHEET = '4456864287772548';
  const PERSONAL_SHEET = '2802755367554948';

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const rowId = body.rowId;
  if (!rowId) return res.status(400).json({ error: 'rowId required' });

  // Fetch personal row and sheet schemas
  const [rowResp, projResp, persResp] = await Promise.all([
    fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}/rows/${rowId}`, {
      headers: { Authorization: 'Bearer ' + token }
    }),
    fetch(`https://api.smartsheet.com/2.0/sheets/${PROJECT_SHEET}`, {
      headers: { Authorization: 'Bearer ' + token }
    }),
    fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
  ]);

  if (!rowResp.ok) return res.status(404).json({ error: 'Row not found' });
  const rowData = await rowResp.json();
  const projectSheet = await projResp.json();
  const personalSheet = await persResp.json();

  const projCols = projectSheet.columns || [];
  const persCols = personalSheet.columns || [];

  function getCellValue(title) {
    const col = persCols.find(c => c.title === title);
    if (!col) return null;
    const cell = (rowData.cells || []).find(c => c.columnId === col.id);
    return cell && cell.value !== undefined && cell.value !== null ? String(cell.value).trim() : null;
  }

  function getProjColId(title) {
    const c = projCols.find(col => col.title === title);
    return c ? c.id : null;
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

  // Build cells array
  const cells = [];
  function addCell(title, val) {
    if (!val) return;
    const colId = getProjColId(title);
    if (!colId) return;
    cells.push({ columnId: colId, objectValue: val });
  }

  addCell('Action ID', text);
  if (owner) addCell('Owner', owner);
  if (status) addCell('Status', status);
  if (dueDate) addCell('Due Date', dueDate);
  if (project) addCell('Project', project);
  if (category && category !== 'Staged') addCell('Category', category);
  if (firm) addCell('Responsible Firm(s)', firm);
  if (sourceRef) addCell('SourceRef', sourceRef);
  if (notes) addCell('Status Note', notes);

  if (cells.length === 0) {
    return res.status(400).json({ error: 'No data to promote' });
  }

  // Write to project sheet
  const writeResp = await fetch(`https://api.smartsheet.com/2.0/sheets/${PROJECT_SHEET}/rows`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cells, toBottom: true })
  });

  const writeData = await writeResp.json();
  if (!writeResp.ok) {
    return res.status(502).json({ error: 'Failed to promote', detail: writeData, cells });
  }

  // Mark personal row as promoted
  const statusCol = persCols.find(c => c.title === 'Status');
  const sourceCol = persCols.find(c => c.title === 'Source');
  const updateCells = [];
  if (statusCol) updateCells.push({ columnId: statusCol.id, value: 'Complete' });
  if (sourceCol) updateCells.push({ columnId: sourceCol.id, value: 'promoted' });
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

  return res.json({ status: 'promoted', projectRowId: writeData.result?.id || null });
}

export const config = { maxDuration: 30 };