// api/create-personal-sheet.js — One-shot: creates the personal sheet and returns its ID
export default async function handler(req, res) {
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'Token not set' });

  const existing = await fetch('https://api.smartsheet.com/2.0/sheets?includeAll=true', {
    headers: { Authorization: 'Bearer ' + token }
  }).then(r => r.json());

  const mySheet = (existing.data || []).find(s =>
    s.name && s.name.toLowerCase().includes('personal') && s.owner === 'Whitney Williams'
  );
  if (mySheet) {
    return res.json({ sheetId: mySheet.id, name: mySheet.name, existing: true });
  }

  // Fetch project log columns to mirror
  const projResp = await fetch(
    'https://api.smartsheet.com/2.0/sheets/4456864287772548?include=columns',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const projData = await projResp.json();
  const projCols = (projData.columns || []).filter(c => c.title !== 'Heirarchy');

  const columns = projCols.map(c => ({
    title: c.title,
    type: c.type,
    options: c.options || undefined,
    symbol: c.symbol || undefined,
    strict: false
  }));

  // Add new columns
  columns.push(
    { title: 'Source', type: 'PICKLIST', options: ['Manual', 'Email', 'Notes'], strict: false },
    { title: 'SourceRef', type: 'TEXT_NUMBER', strict: false },
    { title: 'LinkedRowId', type: 'TEXT_NUMBER', strict: false },
    { title: 'Confidence', type: 'PICKLIST', options: ['High', 'Low'], strict: false }
  );

  const body = {
    name: 'LUCI — Personal Action Log',
    columns: columns
  };

  const createResp = await fetch('https://api.smartsheet.com/2.0/sheets', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const createData = await createResp.json();

  if (!createResp.ok) {
    return res.status(502).json({ error: 'Failed to create sheet', detail: createData });
  }

  res.json({ sheetId: createData.result.id, name: createData.result.name, existing: false });
}