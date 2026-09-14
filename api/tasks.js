// api/tasks.js — GET /api/tasks and POST /api/tasks/:rowId
// GET returns all rows from the Action Tracker sheet
// POST updates the Status cell of a single row
// No credentials in source — uses SMARTSHEET_TOKEN env var only

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });
  }

  const sheetId = '4456864287772548';

  if (req.method === 'POST') {
    return handlePost(req, res, token, sheetId);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  return handleGet(req, res, token, sheetId);
}

// ── GET: fetch all rows ──
async function handleGet(req, res, token, sheetId) {
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

    // Build columnTitle -> columnId map (for POST)
    const titleToColId = {};
    for (const c of columns) {
      titleToColId[c.title] = c.id;
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

// ── POST: update a single row's Status cell ──
async function handlePost(req, res, token, sheetId) {
  try {
    // Extract rowId from URL path (e.g., /api/tasks/1234567890)
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // pathParts = ['api', 'tasks', '<rowId>']
    const rowId = pathParts[2];
    if (!rowId) {
      return res.status(400).json({ error: 'Missing rowId in URL path' });
    }

    // Parse body
    let body;
    try {
      body = JSON.parse(req.body || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const newStatus = body.status;
    if (!newStatus || (newStatus !== 'Complete' && newStatus !== 'Not Started' && newStatus !== 'In Progress')) {
      return res.status(400).json({ error: 'Status must be "Complete", "In Progress", or "Not Started"' });
    }

    // Get the Status column ID from the sheet
    const sheetResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!sheetResp.ok) {
      const err = await sheetResp.text();
      return res.status(502).json({ error: 'Failed to fetch sheet metadata', detail: err });
    }

    const sheetData = await sheetResp.json();
    const statusCol = (sheetData.columns || []).find(c => c.title === 'Status');
    if (!statusCol) {
      return res.status(500).json({ error: 'Status column not found in sheet' });
    }

    // Build the Smartsheet cell update
    const updateBody = {
      cells: [
        {
          columnId: statusCol.id,
          value: newStatus,
          strict: false
        }
      ]
    };

    // PUT the update
    const updateResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateBody)
      }
    );

    const updateData = await updateResp.json();

    if (!updateResp.ok) {
      return res.status(502).json({
        error: 'Smartsheet update failed',
        smartsheetCode: updateData.errorCode,
        detail: updateData.message
      });
    }

    res.json({ success: true, rowId, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };