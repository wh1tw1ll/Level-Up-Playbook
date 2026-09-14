// api/tasks.js — GET /api/tasks
// Returns all rows from the Action Tracker sheet, resolved through column IDs
// No credentials in source — uses SMARTSHEET_TOKEN env var only

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });
  }

  const sheetId = '4456864287772548';

  try {
    const resp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}?include=objectValue`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: 'Smartsheet API error', detail: err });
    }

    const data = await resp.json();
    const rows = data.rows || [];
    const columns = data.columns || [];

    // Build columnId -> columnTitle map
    const colMap = {};
    for (const c of columns) {
      colMap[c.id] = c.title;
    }

    // Parse each row
    const tasks = rows.map(row => {
      const cells = row.cells || [];
      const resolved = {};

      for (const cell of cells) {
        const title = colMap[cell.columnId];
        if (!title) continue;

        let val = null;
        if (cell.value !== undefined && cell.value !== null && cell.value !== '') {
          val = String(cell.value);
        } else if (cell.displayValue) {
          val = String(cell.displayValue);
        }

        resolved[title] = val;
      }

      return {
        rowId: row.id,
        rowNumber: row.rowNumber,
        actionItem: resolved['Action ID'] || null,
        owner: resolved['Owner'] || null,
        status: resolved['Status'] || null,
        dueDate: resolved['Due Date'] || null,
        project: resolved['Project'] || null,
        category: resolved['Category'] || null,
        responsibleFirm: resolved['Responsible Firm(s)'] || null,
        hotTopic: resolved['Hot Topic'] === 'true' || resolved['Hot Topic'] === true,
        hierarchy: resolved['Heirarchy'] || null
      };
    });

    res.json({
      sheet: data.name,
      totalRows: tasks.length,
      tasks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };