// api/debug-promote.js — Debug column types for promote fix
export default async function handler(req, res) {
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });

  const PROJECT_SHEET = '4456864287772548';
  const PERSONAL_SHEET = '2802755367554948';

  const [proj, pers] = await Promise.all([
    fetch(`https://api.smartsheet.com/2.0/sheets/${PROJECT_SHEET}`, {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json()),
    fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}`, {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json())
  ]);

  const projCols = (proj.columns || []).map(c => ({ title: c.title, type: c.type, id: c.id }));
  const persCols = (pers.columns || []).map(c => ({ title: c.title, type: c.type, id: c.id }));

  // Find columns with types that might need objectValue
  const problemTypes = ['CONTACT_LIST', 'PICKLIST', 'MULTI_PICKLIST', 'DATE', 'PREDECESSOR_LIST'];
  const projProblems = projCols.filter(c => problemTypes.includes(c.type));
  const persProblems = persCols.filter(c => problemTypes.includes(c.type));

  // Get a sample row from personal to see cell values
  const personalRows = pers.rows || [];
  const sampleRow = personalRows[0];
  const sampleCells = (sampleRow?.cells || []).map(c => {
    const col = persCols.find(pc => pc.id === c.columnId);
    return { title: col?.title, type: col?.type, columnId: c.columnId, value: c.value, displayValue: c.displayValue, objectValue: c.objectValue };
  });

  res.json({
    projectColumnTypes: projCols,
    personalColumnTypes: persCols,
    problematicColumns: projProblems,
    sampleRowCells: sampleCells
  });
}
export const config = { maxDuration: 30 };