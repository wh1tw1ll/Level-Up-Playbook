// api/tasks.js — GET /api/tasks and POST /api/tasks/:rowId
// Routes all writes through guarded-write.js; reads through smartsheet.js wrapper.

import smartsheet from '../smartsheet.js';
import guardedWrite from '../guarded-write.js';

const SHEET_ID_PROJECT = '4456864287772548';
const SHEET_ID_PERSONAL = '2802755367554948';
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
    // Vercel rewrites /api/tasks/123456 to /api/index?path=tasks/123456
    const fullPath = req.query?.path || '';
    const pathParts = (Array.isArray(fullPath) ? fullPath[0] : fullPath).split('/').filter(Boolean);

  // /api/tasks/:rowId/notes — GET: fetch comments, POST: add comment
  if (pathParts.length >= 3 && pathParts[2] === 'notes') {
    const rowId = pathParts[1];

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
  if (pathParts.length >= 3 && pathParts[2] === 'discussions') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GET only' });
    }
    return handleGetDiscussions(req, res, token, SHEET_ID_PROJECT, pathParts[1]);
  }

  if (req.method === 'POST') {
      // POST to /api/tasks/:rowId — update Status, Status Note, Action ID, or delete
      const source = req.query?.source || 'project';
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
    if (pathParts.length === 2 && pathParts[0] === 'tasks' && pathParts[1] !== 'logo' && pathParts[1] !== 'notes') {
    return handleGetDiscussions(req, res, token, SHEET_ID_PROJECT, pathParts[1]);
  }

  // GET /api/tasks — fetch all rows
    const showNotes = req.query?.showNotes === 'true';
    return handleGet(req, res, token, SHEET_ID_PROJECT, showNotes);
  }

// ── GET: fetch all rows from both sheets, merged ──
async function handleGet(req, res, token, sheetId, showNotes = false) {
  try {
    const [projData, personalData] = await Promise.all([
      smartsheet.getSheet(sheetId),
      smartsheet.getSheet(SHEET_ID_PERSONAL),
    ]);

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
                    seriesMasterId: resolved['SeriesMasterId'] || null,
                    linkedRowId: resolved['LinkedRowId'] || null,
          confidence: resolved['Confidence'] || null,
          discussionCount: commentCount,
          createdAt: row.createdAt || null,
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

        const projectRowCount = projData.rows ? projData.rows.length : 0;
        const projectTotal = projData.totalRowCount || projectRowCount;
        const personalRowCount = personalData.rows ? personalData.rows.length : 0;
        const personalTotal = personalData.totalRowCount || personalRowCount;
        const isTruncated = projectRowCount < projectTotal || personalRowCount < personalTotal;

        res.json({
          sheet: projData.name + ' + Personal',
          totalRows: filtered.length,
          rowCount: projectRowCount + personalRowCount,
          totalInSheet: projectTotal + personalTotal,
          truncated: isTruncated,
          tasks: filtered
        });
      } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── GET discussions for a specific row ──
async function handleGetDiscussions(req, res, token, sheetId, rowId) {
  try {
    const listData = await smartsheet.getDiscussions(sheetId, rowId);
    const discussions = listData.data || [];

    // Fetch each discussion's comments separately
    for (const disc of discussions) {
      try {
        const discData = await smartsheet.getDiscussion(sheetId, disc.id);
        disc.comments = discData.comments || [];
      } catch {
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
    const listData = await smartsheet.getDiscussions(sheetId, rowId);
    const discussions = listData.data || [];

    const notes = [];
    for (const disc of discussions) {
      try {
        const discData = await smartsheet.getDiscussion(sheetId, disc.id);
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
      } catch { continue; }
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
    const listData = await smartsheet.getDiscussions(sheetId, rowId);
    const discussions = listData.data || [];

    let discussionId;
    if (discussions.length > 0) {
      discussionId = discussions[0].id;
    } else {
      try {
        const createData = await smartsheet.createDiscussion(sheetId, rowId, 'Discussion on row ' + rowId, text);
        discussionId = createData.id;
        return res.json({ success: true, discussionId, note: { text, author: '', createdAt: '', id: null } });
      } catch (e) {
        return res.status(502).json({ error: 'Failed to create discussion', detail: e.message });
      }
    }

    const commentData = await smartsheet.addComment(sheetId, discussionId, text);
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
    const fullPath = req.query?.path || '';
    const pathParts = (Array.isArray(fullPath) ? fullPath[0] : fullPath).split('/').filter(Boolean);
    const rowId = pathParts[1]; // ['tasks', '123456'] → '123456'
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

    // Fetch sheet metadata for column IDs (through smartsheet.js wrapper)
    const sheetData = await smartsheet.getSheetWithColumns(sheetId);

    // Build columns for guardedWrite
    const colTitles = {
      status: 'Status',
      actionItem: 'Action ID',
      owner: 'Owner',
      category: 'Category',
      project: 'Project',
      dueDate: 'Due Date',
      responsibleFirm: 'Responsible Firm(s)'
    };

    const guardColumns = [];
    const fieldMap = {
      status: newStatus,
      actionItem: newActionItem,
      owner: newOwner,
      category: newCategory,
      project: newProject,
      dueDate: newDueDate,
      responsibleFirm: newFirm
    };

    for (const [field, value] of Object.entries(fieldMap)) {
      if (value === undefined || value === null || value === '') continue;
      const title = colTitles[field];
      const col = (sheetData.columns || []).find(c => c.title === title);
      if (!col) continue;
      guardColumns.push({
        columnId: col.id,
        type: col.type,
        value: String(value),
        title,
      });
    }

    // Write through guardedWrite
    const result = await guardedWrite({
      sheetId,
      smartsheet,
      existingRowId: rowId,
      columns: guardColumns,
    });

    if (!result.passed) {
      return res.status(422).json({
        error: 'Update rejected by guard',
        reason: result.reason,
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
    const fullPath = req.query?.path || '';
    const pathParts = (Array.isArray(fullPath) ? fullPath[0] : fullPath).split('/').filter(Boolean);
    const rowId = pathParts[1]; // ['tasks', '123456'] → '123456'
    if (!rowId) {
      return res.status(400).json({ error: 'Missing rowId in URL path' });
    }

    const sheetData = await smartsheet.getSheetWithColumns(sheetId);
    const noteCol = (sheetData.columns || []).find(c => c.title === 'Status Note');
    if (!noteCol) {
      return res.status(500).json({ error: 'Status Note column not found in sheet' });
    }

    // Direct update — no guardedWrite wrapper to avoid corrupting Action ID
    await smartsheet.updateRow(sheetId, rowId, [
      { columnId: noteCol.id, ...(noteCol.type === 'PICKLIST' || noteCol.type === 'TEXT_NUMBER' ? { objectValue: String(statusNote) } : { value: String(statusNote) }) },
    ]);

    res.json({ success: true, rowId, statusNote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── HARD DELETE (personal rows only) ──
async function handleDelete(req, res, token, sheetId) {
  try {
    let rowId;
    // Try body first, then URL path fallback
    try {
      const body = parseBody(req.body);
      rowId = body?.rowId;
    } catch {}
    if (!rowId) {
      const fullPath = req.query?.path || '';
      const pathParts = (Array.isArray(fullPath) ? fullPath[0] : fullPath).split('/').filter(Boolean);
      rowId = pathParts[1];
    }
    if (!rowId) {
      return res.status(400).json({ error: 'Missing rowId in request body or URL path' });
    }

    await smartsheet.deleteRows(sheetId, rowId);

    res.json({ success: true, rowId, deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };