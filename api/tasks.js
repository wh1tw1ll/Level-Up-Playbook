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
    // Check if it's a Status Note update (body has statusNote)
    let body;
    try {
      body = JSON.parse(req.body || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    if (body.statusNote !== undefined) {
      return handleStatusNotePost(req, res, token, sheetId, body.statusNote);
    }
    return handlePost(req, res, token, sheetId);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  // Check if this is a discussions request (/api/tasks/12345/discussions)
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 3 && pathParts[2] !== 'logo') {
    return handleGetDiscussions(req, res, token, sheetId, pathParts[2]);
  }

  return handleGet(req, res, token, sheetId);
}

// ── GET: fetch all rows ──
async function handleGet(req, res, token, sheetId) {
  try {
    const resp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}?include=objectValue,discussions`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: 'Smartsheet API error', detail: err });
    }

    const data = await resp.json();
    const rows = data.rows || [];
    const columns = data.columns || [];

    const colMap = {};
    for (const c of columns) {
      colMap[c.id] = c.title;
    }

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

      // Extract discussions
      const discussions = row.discussions || [];
      let latestComment = '';
      let commentCount = 0;
      if (discussions.length > 0) {
        for (const d of discussions) {
          commentCount += d.commentCount || d.comments?.length || 0;
          if (d.comments && d.comments.length > 0) {
            const last = d.comments[d.comments.length - 1];
            const t = last.text || '';
            if (t.length > latestComment.length) {
              latestComment = t;
            }
          }
        }
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
        hierarchy: resolved['Heirarchy'] || null,
        statusNote: resolved['Status Note'] || null,
        discussionCount: commentCount,
        latestDiscussion: latestComment.slice(0, 150),
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

// ── GET discussions for a specific row ──
async function handleGetDiscussions(req, res, token, sheetId, rowId) {
  try {
    const resp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}/discussions`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: 'Failed to fetch discussions', detail: err });
    }
    const data = await resp.json();
    res.json({ discussions: data.data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST: update a single row's Status cell ──
async function handlePost(req, res, token, sheetId) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rowId = pathParts[2];
    if (!rowId) {
      return res.status(400).json({ error: 'Missing rowId in URL path' });
    }

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

    const updateResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cells: [{ columnId: statusCol.id, value: newStatus, strict: false }]
        })
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

// ── POST: update Status Note for a row ──
async function handleStatusNotePost(req, res, token, sheetId, statusNote) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rowId = pathParts[2];
    if (!rowId) {
      return res.status(400).json({ error: 'Missing rowId in URL path' });
    }

    const sheetResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!sheetResp.ok) {
      const err = await sheetResp.text();
      return res.status(502).json({ error: 'Failed to fetch sheet metadata', detail: err });
    }

    const sheetData = await sheetResp.json();
    const noteCol = (sheetData.columns || []).find(c => c.title === 'Status Note');
    if (!noteCol) {
      return res.status(500).json({ error: 'Status Note column not found in sheet' });
    }

    const updateResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cells: [{ columnId: noteCol.id, objectValue: String(statusNote) }]
        })
      }
    );

    if (!updateResp.ok) {
      const err = await updateResp.text();
      return res.status(502).json({ error: 'Status Note update failed', detail: err });
    }

    res.json({ success: true, rowId, statusNote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };