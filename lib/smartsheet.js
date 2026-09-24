// lib/smartsheet.js — Smartsheet API wrapper
// The ONLY file (along with guarded-write.js) allowed to make Smartsheet API calls.

const BASE = 'https://api.smartsheet.com/2.0';
function token() { return process.env.SMARTSHEET_TOKEN || ''; }

async function api(method, path, body) {
  const url = BASE + path;
  const opts = {
    method,
    headers: { Authorization: 'Bearer ' + token() },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Smartsheet API error ' + res.status);
  return data;
}

// Home
async function getHome() {
  return api('GET', '/home?include=sheets');
}

// Sheet-level
async function getSheet(sheetId) {
  return api('GET', '/sheets/' + sheetId + '?include=columns,columnType,discussions&level=1');
}

async function getSheetWithColumns(sheetId) {
  return api('GET', '/sheets/' + sheetId + '?include=columns,columnType&level=2');
}

async function createSheet(name, columns) {
  return api('POST', '/sheets', { name, columns });
}

async function updateSheet(sheetId, updates) {
  return api('PUT', '/sheets/' + sheetId, updates);
}

async function deleteSheet(sheetId) {
  return api('DELETE', '/sheets/' + sheetId);
}

async function addColumn(sheetId, columnDef) {
  // columnDef: { title, type, options?, index? }
  return api('POST', '/sheets/' + sheetId + '/columns', columnDef);
}

// Row-level
async function getRow(sheetId, rowId) {
  return api('GET', '/sheets/' + sheetId + '/rows/' + rowId);
}

async function updateColumn(sheetId, columnId, columnDef) {
  return api('PUT', `/sheets/${sheetId}/columns/${columnId}`, columnDef);
}

async function deleteColumn(sheetId, columnId) {
  return await api('DELETE', `/sheets/${sheetId}/columns/${columnId}`);
}

async function addRow(sheetId, cells) {
  return api('POST', '/sheets/' + sheetId + '/rows', { cells, toBottom: true });
}

async function updateRow(sheetId, rowId, cells) {
  return api('PUT', '/sheets/' + sheetId + '/rows/' + rowId, { cells });
}

async function updateRows(sheetId, rows) {
  // Batch update multiple rows: rows = [{id, cells: [...]}, ...]
  return api('PUT', '/sheets/' + sheetId + '/rows', rows.map(r => ({ id: r.id, cells: r.cells })));
}

async function deleteRows(sheetId, rowIds) {
  const ids = Array.isArray(rowIds) ? rowIds.join(',') : rowIds;
  return api('DELETE', '/sheets/' + sheetId + '/rows?ids=' + ids);
}

// Discussion operations
async function getDiscussion(sheetId, discussionId) {
  return api('GET', '/sheets/' + sheetId + '/discussions/' + discussionId);
}

async function getDiscussions(sheetId, rowId) {
  return api('GET', '/sheets/' + sheetId + '/rows/' + rowId + '/discussions');
}

async function createDiscussion(sheetId, rowId, title, commentText) {
  return api('POST', '/sheets/' + sheetId + '/rows/' + rowId + '/discussions', { title, comment: { text: commentText } });
}

async function addComment(sheetId, discussionId, text) {
  return api('POST', '/sheets/' + sheetId + '/discussions/' + discussionId + '/comments', { text });
}

export default {
  getHome, getSheet, getSheetWithColumns, createSheet, updateSheet, deleteSheet, addColumn, updateColumn, deleteColumn,
  getRow, addRow, updateRow, updateRowCells: updateRow, updateRows, deleteRows,
  getDiscussion, getDiscussions, createDiscussion, addComment,
};