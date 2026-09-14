// api/actions.js — Serves the standalone LUCI Action Items HTML
export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LUCI — Tasks</title>
<link rel="icon" type="image/svg+xml" href="assets/LUCI_icon.svg">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box}
:root{--bg:#1e1e2e;--fg:#cdd6f4;--accent:#89b4fa;--card:#313244;--border:#45475a;--success:#a6e3a1;--warn:#f9e2af;--danger:#f38ba8;--muted:#585b70;--hover:#45475a;--radius:6px;--font:"Aptos","Aptos Display","Segoe UI Variable","Segoe UI",system-ui,sans-serif}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font-family:var(--font);font-size:15px;line-height:1.4;overflow:hidden;height:100%}
body{display:flex;flex-direction:column}
/* Header */
.header{flex:0 0 auto;padding:0;border-bottom:1px solid var(--border)}
.header-top{display:flex;align-items:center;gap:6px;padding:6px 8px}
.header-logo{height:32px;width:auto}
.header-title{font-weight:600;font-size:15px;color:var(--accent);letter-spacing:-0.3px}
.header-subtitle{font-size:12px;color:var(--muted);margin-left:auto}
.header-subtitle span{cursor:pointer}
.header-subtitle span:hover{color:var(--accent)}
/* Tabs */
.tabs{display:flex;gap:2px;padding:0 8px 4px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:4px 10px;border-radius:var(--radius) var(--radius) 0 0;font-size:12px;font-weight:500;cursor:pointer;color:var(--muted);white-space:nowrap;background:transparent;border:none;transition:all .15s}
.tab:hover{color:var(--fg);background:var(--hover)}
.tab.active{color:var(--accent);background:var(--card)}
/* Filters */
.filters{flex:0 0 auto;display:flex;gap:4px;padding:4px 8px;align-items:center;border-bottom:1px solid var(--border)}
.filters input{flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:4px 8px;color:var(--fg);font-size:14px;outline:none;min-width:0}
.filters input:focus{border-color:var(--accent)}
.filters input::placeholder{color:var(--muted)}
.filter-select{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:3px 6px;color:var(--fg);font-size:13px;outline:none;cursor:pointer}
.filter-count{font-size:13px;color:var(--muted);margin-left:auto;white-space:nowrap}
/* Task List */
.tasks{flex:1;overflow-y:auto;overflow-x:hidden;padding:2px 0}
.tasks:empty::after{content:'No tasks match filters.';display:block;padding:24px;text-align:center;color:var(--muted);font-size:13px}
.task{display:flex;gap:6px;padding:5px 8px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s;align-items:flex-start}
.task:hover{background:var(--hover)}
.task.overdue{background:rgba(243,139,168,0.06)}
.task.completed{opacity:0.5}
.task.completed:hover{opacity:0.7}
.task-check{flex:0 0 16px;margin-top:2px;width:14px;height:14px;border:1.5px solid var(--muted);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;transition:all .15s;cursor:pointer}
.task-check:hover{border-color:var(--accent)}
.task-check.done{background:var(--success);border-color:var(--success);color:var(--bg)}
.task-body{flex:1;min-width:0}
.task-title{font-size:14px;font-weight:450;color:var(--fg);line-height:1.3;word-break:break-word}
.completed .task-title{text-decoration:line-through}
.task-meta{display:flex;gap:6px;margin-top:2px;flex-wrap:wrap;align-items:center}
.meta-tag{font-size:12px;padding:1px 5px;border-radius:3px;white-space:nowrap;line-height:1.4}
.meta-tag.owner{background:rgba(137,180,250,0.15);color:var(--accent)}
.meta-tag.due{color:var(--muted)}
.meta-tag.due.overdue-tag{color:var(--danger)}
.meta-tag.due.soon{color:var(--warn)}
.meta-tag.project{background:rgba(166,227,161,0.12);color:var(--success)}
.meta-tag.firm{background:rgba(147,153,178,0.1);color:var(--muted)}
.meta-tag.status{background:rgba(249,226,175,0.12);color:var(--warn)}
.meta-tag.status.complete{background:rgba(166,227,161,0.12);color:var(--success)}
.meta-tag.status.inactive{background:rgba(88,91,112,0.2);color:var(--muted)}
.meta-tag.hot{background:var(--danger);color:var(--bg)}
.meta-tag.disc{background:rgba(137,180,250,0.12);color:var(--accent);cursor:pointer}
.meta-tag.disc:hover{background:rgba(137,180,250,0.25)}
.status-note{font-size:12px;color:var(--muted);margin:2px 0 0;display:flex;align-items:center;gap:4px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;padding:1px 0;min-height:0}
.status-note:hover{color:var(--accent);background:rgba(137,180,250,0.08);border-radius:3px}
.status-note-empty{cursor:text;height:0;overflow:visible;position:relative}
.status-note-empty::after{content:'';display:block;height:2px;margin:1px 0;border-radius:1px;transition:background .15s}
.task:hover .status-note-empty::after{background:var(--border)}
.status-note-input{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:1px 6px;color:var(--fg);font-size:12px;width:100%;outline:none;margin-top:2px;font-family:var(--font)}
.status-note-input:focus{border-color:var(--accent)}
/* Notes / expanded row */
.task-expanded{background:rgba(49,50,68,0.8);border:1px solid var(--accent);border-radius:var(--radius);margin:2px 4px;padding:6px 8px}
.task-notes{font-size:12px;margin:4px 0 0;display:flex;flex-direction:column;gap:2px}
.note-msg{padding:3px 0 3px 16px;border-left:2px solid var(--border);margin:0 0 2px}
.note-author{color:var(--accent);font-weight:500;font-size:11px}
.note-time{color:var(--muted);font-size:10px;margin-left:4px}
.note-text{color:var(--fg);margin:1px 0 0;word-break:break-word;font-size:12px}
.note-empty{padding:8px 0;color:var(--muted);font-size:11px;text-align:center}
.note-input-area{display:flex;gap:4px;margin-top:4px;align-items:flex-start}
.note-input{flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:4px 6px;color:var(--fg);font-size:12px;outline:none;resize:none;font-family:var(--font);min-height:28px;max-height:80px;line-height:1.3}
.note-input:focus{border-color:var(--accent)}
.note-input::placeholder{color:var(--muted)}
.note-send{padding:4px 10px;background:var(--accent);color:var(--bg);border:none;border-radius:var(--radius);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;line-height:20px}
.note-send:hover{opacity:0.85}
.note-send:disabled{opacity:0.4;cursor:default}
.note-status-line{margin-bottom:4px;padding:2px 0;border-bottom:1px solid var(--border)}
.status-bar{flex:0 0 auto;padding:3px 8px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);display:flex;justify-content:space-between}
</style>
</head>
<body>
<div class="header">
  <div class="header-top">
    <img class="header-logo" src="/api/logo" alt="Level Up">
    <span class="header-title">Tasks</span>
    <span class="header-subtitle"><span id="updated-at"></span></span>
  </div>
  <div class="tabs" id="project-tabs">
    <button class="tab active" data-project="all">All</button>
    <button class="tab" data-project="DOVA">DOVA</button>
    <button class="tab" data-project="MFP">MFP</button>
    <button class="tab" data-project="Sphere">Sphere</button>
    <button class="tab" data-project="SPH">SPH</button>
    <button class="tab" data-project="Business">Business</button>
  </div>
</div>
<div class="filters">
  <input id="search-input" type="text" placeholder="Search actions..." autocomplete="off">
  <select class="filter-select" id="status-filter">
    <option value="">All</option>
    <option value="open" selected>Open</option>
    <option value="closed">Closed</option>
  </select>
  <select class="filter-select" id="owner-filter">
    <option value="">All Owners</option>
  </select>
  <span class="filter-count" id="count-display">0 tasks</span>
</div>
<div class="tasks" id="task-list"></div>
<div class="status-bar">
  <span id="my-tasks-count"></span>
  <span id="refresh-status"></span>
</div>
<script>
// ── STATE ──
let allTasks = [];
let myName = 'Whitney Williams';
let currentProject = 'all';
let currentStatus = 'open';
let currentOwner = '';
let searchText = '';

// ── HELPERS ──
function daysUntil(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function isThisWeek(d) {
  if (!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + 'T00:00:00');
  const diff = Math.round((due - today) / 86400000);
  return diff >= 0 && diff <= 7;
}

function isOverdue(d) {
  if (!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + 'T00:00:00');
  return due < today;
}

function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── FILTER + RENDER ──
function render() {
  const q = searchText.toLowerCase().trim();
  const ownerVal = currentOwner;

  // Filter
  let filtered = allTasks.filter(t => {
    if (currentProject !== 'all' && t.project !== currentProject) return false;
    if (currentStatus === 'open' && t.status !== 'Not Started' && t.status !== 'In Progress') return false;
    if (currentStatus === 'closed' && t.status !== 'Complete') return false;
    if (ownerVal && t.owner !== ownerVal) return false;
    if (q) {
      const text = ((t.actionItem || '') + ' ' + (t.notes || '') + ' ' + (t.responsibleFirm || '')).toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  // Sort: my tasks first, then overdue, then this week, then by date
  filtered.sort((a, b) => {
    const aMine = a.owner === myName ? 0 : 1;
    const bMine = b.owner === myName ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;

    const aOver = isOverdue(a.dueDate) ? 0 : 1;
    const bOver = isOverdue(b.dueDate) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;

    const aWeek = a.status !== 'Complete' && isThisWeek(a.dueDate) ? 0 : 1;
    const bWeek = b.status !== 'Complete' && isThisWeek(b.dueDate) ? 0 : 1;
    if (aWeek !== bWeek) return aWeek - bWeek;

    // Sort by due date ascending (no date = last)
    const ad = a.dueDate || '9999-12-31';
    const bd = b.dueDate || '9999-12-31';
    return ad.localeCompare(bd);
  });

  // Render
  const list = document.getElementById('task-list');
  list.innerHTML = '';

  for (const t of filtered) {
    const isComplete = t.status === 'Complete';
    const over = !isComplete && isOverdue(t.dueDate);
    const cls = 'task' + (over ? ' overdue' : '') + (isComplete ? ' completed' : '');

    const dueDays = daysUntil(t.dueDate);
    let dueLabel = '';
    let dueClass = 'due';
    if (t.dueDate) {
      if (over) { dueLabel = dueDays === 0 ? 'Due today' : Math.abs(dueDays) + ' days overdue'; dueClass += ' overdue-tag'; }
      else if (dueDays === 0) { dueLabel = 'Due today'; dueClass += ' soon'; }
      else if (dueDays <= 3) { dueLabel = formatDate(t.dueDate) + ' (' + dueDays + 'd)'; dueClass += ' soon'; }
      else { dueLabel = formatDate(t.dueDate); }
    }

    let statusLabel = t.status || '';
    let statusClass = 'status';
    if (t.status === 'Complete') statusClass += ' complete';
    else if (t.status === 'Not Started') statusClass += ' inactive';

    let firm = t.responsibleFirm || '';

    const div = document.createElement('div');
        div.className = cls;
        div.dataset.rowId = t.rowId;
        div.onclick = function(e) { if (e.target.closest('.task-check,.status-note,.status-note-input,.note-input,.note-send')) return; toggleRow(this, t.rowId); };
        let discBadge = '';
        if (t.discussionCount > 0) {
          discBadge = '<span class="meta-tag disc">💬 ' + t.discussionCount + '</span>';
        }
        let snHtml = '';
            if (!isComplete && t.statusNote) {
              snHtml = '<div class="status-note" title="Click to edit" onclick="event.stopPropagation();editStatusNote(this,' + t.rowId + ')">' + escapeHtml(t.statusNote) + '</div>';
            }
        div.innerHTML =
          '<div class="task-check' + (isComplete ? ' done' : '') + '" onclick="event.stopPropagation();toggleTask(this,' + t.rowId + ')">' +
            (isComplete ? '&#10003;' : '') +
          '</div>' +
          '<div class="task-body">' +
            '<div class="task-title">' + escapeHtml(t.actionItem) + '</div>' +
            snHtml +
            '<div class="task-meta">' +
              (t.owner ? '<span class="meta-tag owner">' + escapeHtml(t.owner) + '</span>' : '') +
              (t.dueDate ? '<span class="meta-tag ' + dueClass + '">' + dueLabel + '</span>' : '') +
              (t.project ? '<span class="meta-tag project">' + escapeHtml(t.project) + '</span>' : '') +
              (firm ? '<span class="meta-tag firm">' + escapeHtml(firm) + '</span>' : '') +
              (t.status ? '<span class="meta-tag ' + statusClass + '">' + escapeHtml(t.status) + '</span>' : '') +
              discBadge +
            '</div>' +
          '</div>';
        list.appendChild(div);
  }

  // Counts
  const myTasks = allTasks.filter(t => t.owner === myName && t.status !== 'Complete').length;
  document.getElementById('count-display').textContent = filtered.length + ' tasks';
  document.getElementById('my-tasks-count').textContent = myTasks + ' mine open';
}

// ── DATA LOADING ──
function loadTasks() {
  const statusEl = document.getElementById('refresh-status');
  statusEl.textContent = 'Loading...';

  fetch('/api/tasks')
    .then(r => r.json())
    .then(data => {
      allTasks = data.tasks || [];
      // Populate owner filter
      const owners = new Set(allTasks.map(t => t.owner).filter(Boolean));
      const sel = document.getElementById('owner-filter');
      sel.innerHTML = '<option value="">All Owners</option>';
      [...owners].sort().forEach(o => {
        sel.innerHTML += '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>';
      });
      render();
      const now = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
      document.getElementById('updated-at').textContent = now;
      statusEl.textContent = '';
      // Cache in localStorage
      try { localStorage.setItem('luci_tasks_cache', JSON.stringify(data)); } catch(e) {}
    })
    .catch(err => {
      statusEl.textContent = 'Error loading';
      // Try cache
      try {
        const cached = localStorage.getItem('luci_tasks_cache');
        if (cached) {
          const data = JSON.parse(cached);
          allTasks = data.tasks || [];
          render();
          document.getElementById('updated-at').textContent = 'cached';
          statusEl.textContent = 'Offline (cached)';
        }
      } catch(e) {}
    });
}

// ── TOGGLE TASK (optimistic) ──
function toggleTask(el, rowId) {
  const taskEl = el.closest('.task');
  const isDone = el.classList.contains('done');

  // Optimistic UI
  el.classList.toggle('done');
  el.innerHTML = isDone ? '' : '&#10003;';
  taskEl.classList.toggle('completed');

  const newStatus = isDone ? 'Not Started' : 'Complete';

  // Write to API
  fetch('/api/tasks/' + rowId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  })
    .then(r => {
      if (!r.ok) {
        // Revert optimistic UI on failure
        el.classList.toggle('done');
        el.innerHTML = isDone ? '&#10003;' : '';
        taskEl.classList.toggle('completed');
        console.error('Toggle failed');
      } else {
        // Refresh to get up-to-date data
        loadTasks();
      }
    })
    .catch(() => {
      // Revert on network error
      el.classList.toggle('done');
      el.innerHTML = isDone ? '&#10003;' : '';
      taskEl.classList.toggle('completed');
    });
}

// ── ROW EXPANSION ──
let expandedRowId = null;
let expandedElement = null;

function toggleRow(el, rowId) {
  if (expandedRowId === rowId) {
    collapseRow();
    return;
  }
  collapseRow();
  expandedRowId = rowId;
  expandedElement = el;
  el.classList.add('task-expanded');
  renderNotes(rowId);
}

function collapseRow() {
  if (expandedElement) {
    expandedElement.classList.remove('task-expanded');
  }
  const notesArea = document.getElementById('notes-area');
  if (notesArea) notesArea.remove();
  expandedRowId = null;
  expandedElement = null;
}

function renderNotes(rowId) {
  // Remove old notes area
  const old = document.getElementById('notes-area');
  if (old) old.remove();

  const area = document.createElement('div');
  area.id = 'notes-area';
  area.className = 'task-notes';
  area.innerHTML = '<div class="note-empty">Loading...</div>';

  // Insert after the expanded row
  if (expandedElement && expandedElement.nextSibling) {
    expandedElement.parentNode.insertBefore(area, expandedElement.nextSibling);
  } else if (expandedElement) {
    expandedElement.parentNode.appendChild(area);
  }

  // Fetch notes
  fetch('/api/tasks/' + rowId + '/notes')
    .then(r => r.json())
    .then(data => {
      const notes = data.notes || [];
      let html = '';
      if (notes.length === 0) {
        html = '<div class="note-empty">No notes yet</div>';
      } else {
        for (const n of notes) {
          const author = escapeHtml(n.author || '?');
          const ts = n.createdAt ? new Date(n.createdAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
          const text = escapeHtml(n.text || '');
          html += '<div class="note-msg"><span class="note-author">' + author + '</span><span class="note-time">' + ts + '</span><div class="note-text">' + text + '</div></div>';
        }
      }
      // Add input area
      html += '<div class="note-input-area">' +
        '<textarea class="note-input" placeholder="Add a note..." rows="1"></textarea>' +
        '<button class="note-send" onclick="submitNote(' + rowId + ')">Send</button>' +
        '</div>';
      // Add status line (editable) above notes
      html = '<div class="note-status-line" id="nl-' + rowId + '"></div>' + html;
      area.innerHTML = html;

      // Load the status note value
      fetch('/api/tasks')
        .then(r => r.json())
        .then(allData => {
          const task = (allData.tasks || []).find(t => t.rowId == rowId);
          const snDiv = area.querySelector('.note-status-line');
          if (!snDiv) return;
          if (task && task.statusNote) {
            snDiv.innerHTML = '<div class="status-note" onclick="event.stopPropagation();editExpandedNote(this,' + rowId + ')">' + escapeHtml(task.statusNote) + '</div>';
          } else {
            snDiv.innerHTML = '<div class="status-note" onclick="event.stopPropagation();editExpandedNote(this,' + rowId + ')" style="opacity:0.4">Status note...</div>';
          }
        })
        .catch(() => {});

      // Wire up textarea submit
      const ta = area.querySelector('.note-input');
      if (ta) {
        ta.focus();
        ta.onkeydown = function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitNote(rowId);
          }
        };
        // Auto-grow
        ta.oninput = function() {
          this.style.height = 'auto';
          this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        };
      }
    })
    .catch(() => {
      area.innerHTML = '<div class="note-empty">Failed to load notes</div>' +
        '<div class="note-input-area">' +
        '<textarea class="note-input" placeholder="Add a note..." rows="1"></textarea>' +
        '<button class="note-send" onclick="submitNote(' + rowId + ')">Send</button>' +
        '</div>';
    });
}

function submitNote(rowId) {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const ta = area.querySelector('.note-input');
  const btn = area.querySelector('.note-send');
  if (!ta || !ta.value.trim()) return;
  const text = ta.value.trim();

  // Optimistic: disable and show sending
  ta.disabled = true;
  btn.disabled = true;
  btn.textContent = 'Sending...';

  // Post note
  fetch('/api/tasks/' + rowId + '/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
    .then(r => r.json())
    .then(data => {
      // Clear and reload notes
      ta.value = '';
      ta.disabled = false;
      btn.disabled = false;
      btn.textContent = 'Send';
      ta.style.height = 'auto';
      ta.focus();
      renderNotes(rowId);  // Refresh thread
    })
    .catch(() => {
      // Revert on error
      ta.disabled = false;
      btn.disabled = false;
      btn.textContent = 'Send';
      ta.style.borderColor = 'var(--danger)';
      setTimeout(() => { ta.style.borderColor = ''; }, 2000);
    });
}

// ── STATUS NOTE (inline edit) ──
function editStatusNote(el, rowId) {
  const currentText = el.textContent === 'Status note...' ? '' : el.textContent;
  const input = document.createElement('input');
  input.className = 'status-note-input';
  input.type = 'text';
  input.value = currentText;
  input.placeholder = 'Add status note...';
  el.replaceWith(input);
  input.focus();
  input.select();

  function save() {
    const newText = input.value.trim();

    // Create status note div
    const div = document.createElement('div');
    div.className = 'status-note';
    div.textContent = newText;
    div.onclick = function(e) { e.stopPropagation(); editStatusNote(this, rowId); };
    input.replaceWith(div);

    // Write to API
    fetch('/api/tasks/' + rowId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusNote: newText })
    }).catch(() => {});
  }

  input.onblur = save;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { save(); }
    if (e.key === 'Escape') { input.blur(); }
  };
}

function editExpandedNote(el, rowId) {
  editStatusNote(el, rowId);
}

// ── EVENT BINDING ──
document.addEventListener('DOMContentLoaded', function() {
  // Tabs
  document.getElementById('project-tabs').addEventListener('click', function(e) {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentProject = tab.dataset.project;
    render();
  });

  // Search
  document.getElementById('search-input').addEventListener('input', function() {
    searchText = this.value;
    render();
  });

  // Status filter
  document.getElementById('status-filter').addEventListener('change', function() {
    currentStatus = this.value;
    render();
  });

  // Owner filter
  document.getElementById('owner-filter').addEventListener('change', function() {
    currentOwner = this.value;
    render();
  });

  // Initial load from cache then fetch
  try {
    const cached = localStorage.getItem('luci_tasks_cache');
    if (cached) {
      const data = JSON.parse(cached);
      allTasks = data.tasks || [];
      render();
      document.getElementById('updated-at').textContent = 'cached';
    }
  } catch(e) {}
  loadTasks();
});
</script>
</body>
</html>`);
}