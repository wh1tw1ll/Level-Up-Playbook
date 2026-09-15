// api/tasks.js — GET /api/tasks and POST /api/tasks/:rowId
// GET returns all rows from the Action Tracker sheet
// GET /api/tasks/:rowId/discussions — get discussions with comments for a row
// GET /api/tasks/:rowId/notes — flattened comment thread for a row
// POST /api/tasks/:rowId — update Status cell
// POST /api/tasks/:rowId/notes — add a comment (creates discussion if needed)
// POST /api/tasks/:rowId with body {statusNote: "..."} — update Status Note column
function parseBody(b) {
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  if (b && typeof b === 'object' && b.type === 'Buffer' && Array.isArray(b.data)) {
    try { return JSON.parse(Buffer.from(b.data).toString('utf8')); } catch { return {}; }
  }
  if (b && typeof b === 'object') return b;
  return {};
}

export default async function handler(req, res) {
  const SHEET_ID_PROJECT = '4456864287772548';
  const SHEET_ID_PERSONAL = '2802755367554948';
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.SMARTSHEET_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });
    }

    // Parse path to determine sub-route
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  // /api/tasks/:rowId/notes — GET: fetch comments, POST: add comment
  if (pathParts.length >= 4 && pathParts[3] === 'notes') {
    const rowId = pathParts[2];

    if (req.method === 'GET') {
      return handleGetNotes(req, res, token, SHEET_ID_PROJECT, rowId);
    }
    if (req.method === 'POST') {
      let body;
      try {
        body = parseBody(req.body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
      return handlePostNote(req, res, token, SHEET_ID_PROJECT, rowId, body.text || '');
    }
    return res.status(405).json({ error: 'GET or POST only' });
  }

  // /api/tasks/:rowId/discussions — GET: fetch discussions with comments (legacy)
  if (pathParts.length >= 4 && pathParts[3] === 'discussions') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GET only' });
    }
    return handleGetDiscussions(req, res, token, SHEET_ID_PROJECT, pathParts[2]);
  }

  if (req.method === 'POST') {
      // POST to /api/tasks/:rowId — update Status, Status Note, Action ID, or delete
      const source = url.searchParams.get('source') || 'project';
      const targetSheetId = source === 'personal' ? SHEET_ID_PERSONAL : SHEET_ID_PROJECT;

      let body;
      try {
        body = parseBody(req.body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      if (body.action === 'delete') {
        return handleDelete(req, res, token, targetSheetId);
      }
      if (body.statusNote !== undefined) {
        return handleStatusNotePost(req, res, token, targetSheetId, body.statusNote);
      }
      return handlePost(req, res, token, targetSheetId);
    }

  // GET /api/tasks/:rowId — legacy discussion fetch (only when no sub-resource)
    if (pathParts.length === 3 && pathParts[2] !== 'logo' && pathParts[2] !== 'notes') {
    return handleGetDiscussions(req, res, token, SHEET_ID_PROJECT, pathParts[2]);
  }

  // GET /api/tasks — fetch all rows
    const showNotes = url.searchParams.get('showNotes') === 'true';
    return handleGet(req, res, token, SHEET_ID_PROJECT, showNotes);
  }

// ── GET: fetch all rows from both sheets, merged ──
async function handleGet(req, res, token, sheetId, showNotes = false) {
  try {
    const [projResp, personalResp] = await Promise.all([
      fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}?include=objectValue,discussions`,
        { headers: { Authorization: 'Bearer ' + token } }
      ),
      fetch(
              `https://api.smartsheet.com/2.0/sheets/2802755367554948?include=objectValue,discussions`,
        { headers: { Authorization: 'Bearer ' + token } }
      )
    ]);

    if (!projResp.ok) {
      const err = await projResp.text();
      return res.status(502).json({ error: 'Project log fetch failed', detail: err });
    }
    if (!personalResp.ok) {
      const err = await personalResp.text();
      return res.status(502).json({ error: 'Personal sheet fetch failed', detail: err });
    }

    const projData = await projResp.json();
    const personalData = await personalResp.json();

    function extractTasks(data, source) {
      const rows = data.rows || [];
      const columns = data.columns || [];
      const colMap = {};
      for (const c of columns) colMap[c.id] = c.title;

      return rows.map(row => {
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

        const discussions = row.discussions || [];
        let commentCount = 0;
        for (const d of discussions) commentCount += d.commentCount || d.comments?.length || 0;

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
          source: source,
          sourceRef: resolved['SourceRef'] || null,
          linkedRowId: resolved['LinkedRowId'] || null,
          confidence: resolved['Confidence'] || null,
          discussionCount: commentCount,
        };
      });
    }

    const projectTasks = extractTasks(projData, 'project');
        const personalTasks = extractTasks(personalData, 'personal');
        const merged = [...projectTasks, ...personalTasks];

        const sectionHeaders = [
          'next steps', 'action items', 'proposal and next steps',
          'new items added and next steps', 'general action item log review',
          'granola setup and next steps', 'advice for whitney and next steps',
          'outreach to trade contractors and next steps',
          '1.', '2.', '3.',
        ];

        // Filter out Meeting Note rows (and section headers) unless showNotes is true
        const filtered = merged.filter(t => {
          if (showNotes) return true;
          const cat = (t.category || '').toLowerCase();
          const title = (t.actionItem || '').toLowerCase().trim();
          if (cat === 'meeting note') return false;
          if (sectionHeaders.includes(title)) return false;
          return true;
        });

        // Sort
        filtered.sort((a, b) => {
      // Completed at bottom
      if (a.status === 'Complete' && b.status !== 'Complete') return 1;
      if (a.status !== 'Complete' && b.status === 'Complete') return -1;
      if (a.status === 'Archived' && b.status !== 'Archived') return 1;
      if (a.status !== 'Archived' && b.status === 'Archived') return -1;
      // Due date sort
      const ad = a.dueDate || '9999-12-31';
      const bd = b.dueDate || '9999-12-31';
      return ad.localeCompare(bd);
    });

        res.json({
                  sheet: projData.name + ' + Personal',
                  totalRows: filtered.length,
                  tasks: filtered
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
    const discussions = data.data || [];

    // Fetch each discussion's comments separately
    for (const disc of discussions) {
      const discResp = await fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}/discussions/${disc.id}`,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      if (discResp.ok) {
        const discData = await discResp.json();
        disc.comments = discData.comments || [];
      } else {
        disc.comments = [];
      }
    }

    res.json({ discussions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── GET notes: flattened comment thread for a row ──
async function handleGetNotes(req, res, token, sheetId, rowId) {
  try {
    const listResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}/discussions`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!listResp.ok) {
      const err = await listResp.text();
      return res.status(502).json({ error: 'Failed to fetch notes', detail: err });
    }
    const listData = await listResp.json();
    const discussions = listData.data || [];

    const notes = [];
    for (const disc of discussions) {
      const discResp = await fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}/discussions/${disc.id}`,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      if (!discResp.ok) continue;
      const discData = await discResp.json();
      const comments = discData.comments || [];
      for (const c of comments) {
        notes.push({
          id: c.id,
          text: c.text || '',
          author: c.createdBy ? (c.createdBy.name || c.createdBy.email || '?') : '?',
          createdAt: c.createdAt || '',
          discussionId: disc.id
        });
      }
    }

    notes.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    res.json({ notes, discussionCount: discussions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST note: add a comment to an existing discussion, or create one first ──
async function handlePostNote(req, res, token, sheetId, rowId, text) {
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text field is required' });
  }

  try {
    const listResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}/discussions`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!listResp.ok) {
      const err = await listResp.text();
      return res.status(502).json({ error: 'Failed to fetch discussions', detail: err });
    }
    const listData = await listResp.json();
    const discussions = listData.data || [];

    let discussionId;
    if (discussions.length > 0) {
      discussionId = discussions[0].id;
    } else {
      const createResp = await fetch(
        `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}/discussions`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Discussion on row ' + rowId, comment: { text } })
        }
      );
      if (!createResp.ok) {
        const err = await createResp.text();
        return res.status(502).json({ error: 'Failed to create discussion', detail: err });
      }
      const createData = await createResp.json();
      discussionId = createData.id;
      return res.json({ success: true, discussionId, note: { text, author: '', createdAt: '', id: null } });
    }

    const commentResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/discussions/${discussionId}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      }
    );
    if (!commentResp.ok) {
      const err = await commentResp.text();
      return res.status(502).json({ error: 'Failed to add comment', detail: err });
    }

    const commentData = await commentResp.json();
    res.json({
          success: true,
          discussionId,
          note: {
            id: commentData.id,
            text: commentData.text || text,
            author: commentData.createdBy ? (commentData.createdBy.name || commentData.createdBy.email || '?') : '?',
            createdAt: commentData.createdAt || ''
          }
        });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST: update a single row's Status or Action Item ──
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
      body = parseBody(req.body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const newStatus = body.status;
        const newActionItem = body.actionItem;
        const newOwner = body.owner;
        const newCategory = body.category;
        const newProject = body.project;
        const newDueDate = body.dueDate;
        const newFirm = body.responsibleFirm;

        if (!newStatus && newActionItem === undefined && !newOwner && !newCategory && !newProject && !newDueDate && !newFirm) {
          return res.status(400).json({ error: 'No fields to update. Provide at least one field.' });
        }

        // Lazy-fetch sheet metadata only when needed
        let sheetData = null;
        async function getSheet() {
          if (sheetData) return sheetData;
          const resp = await fetch(`https://api.smartsheet.com/2.0/sheets/${sheetId}`, { headers: { Authorization: 'Bearer ' + token } });
          if (!resp.ok) throw new Error('Failed to fetch sheet metadata');
          sheetData = await resp.json();
          return sheetData;
        }

            // Build cells from provided fields
            const cells = [];
            const colTitles = {
              status: 'Status',
              actionItem: 'Action ID',
              owner: 'Owner',
              category: 'Category',
              project: 'Project',
              dueDate: 'Due Date',
              responsibleFirm: 'Responsible Firm(s)'
            };

            async function addCell(field, value) {
                          if (value === undefined || value === null || value === '') return;
                          const s = await getSheet();
                          const col = (s.columns || []).find(c => c.title === colTitles[field]);
                          if (!col) return;
                          const isPicklist = col.type !== 'TEXT_NUMBER';
                          if (isPicklist) {
                            cells.push({ columnId: col.id, objectValue: String(value), strict: false });
                          } else {
                            cells.push({ columnId: col.id, value: String(value), strict: false });
                          }
                        }

            await Promise.all([
              newStatus && addCell('status', newStatus),
              newActionItem !== undefined && addCell('actionItem', newActionItem),
              newOwner && addCell('owner', newOwner),
              newCategory && addCell('category', newCategory),
              newProject && addCell('project', newProject),
              newDueDate && addCell('dueDate', newDueDate),
              newFirm && addCell('responsibleFirm', newFirm)
            ]);

    const updateResp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows/${rowId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cells })
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

            res.json({ success: true, rowId, status: newStatus, actionItem: newActionItem });
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

// ── HARD DELETE (personal rows only) ──
async function handleDelete(req, res, token, sheetId) {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rowId = pathParts[2];
    if (!rowId) {
      return res.status(400).json({ error: 'Missing rowId in URL path' });
    }

    const delResp = await fetch(
      'https://api.smartsheet.com/2.0/sheets/' + sheetId + '/rows/' + rowId,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
    );

    if (!delResp.ok) {
      const err = await delResp.text();
      return res.status(502).json({ error: 'Delete failed', detail: err });
    }

    res.json({ success: true, rowId, deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };