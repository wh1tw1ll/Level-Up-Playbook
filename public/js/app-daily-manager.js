// ── DAILY MANAGER — Task list + Prep view ──
// Extracted from tasks.html, adapted as callable renderDailyManager()
// All var, no let/const — consistent with LUCI codebase

function renderDailyManager() {
try {
// ── STATE ──
var allTasks = [];
var myName = 'Whitney Williams';
var currentProject = 'all';
var currentCategory = '';
var currentStatus = 'open';
var currentOwner = '';
var currentSeries = '';
var currentSource = 'all';
var currentSourceRef = '';
var searchText = '';
var quickFilters = { overdue: false, week: false, hot: false, mine: false };

// ── HELPERS ──
function daysUntil(d) {
  if (!d) return null;
  var today = new Date(); today.setHours(0,0,0,0);
  var due = new Date(d + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

function formatDate(d) {
  if (!d) return '';
  var dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function isThisWeek(d) {
  if (!d) return false;
  var today = new Date(); today.setHours(0,0,0,0);
  var due = new Date(d + 'T00:00:00');
  var diff = Math.round((due - today) / 86400000);
  return diff >= 0 && diff <= 7;
}

function isOverdue(d) {
  if (!d) return false;
  var today = new Date(); today.setHours(0,0,0,0);
  var due = new Date(d + 'T00:00:00');
  return due < today;
}

function escapeHtml(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function displayStatus(s) {
  if (!s) return '';
  if (s === 'Complete') return 'Closed';
  return s;
}

// ── SOUND ──
var audioCtx = null;
var soundEnabled = false;
try { soundEnabled = localStorage.getItem('luci_sound') === 'on'; } catch(e) {}
function toggleSound() {
  soundEnabled = !soundEnabled;
  try { localStorage.setItem('luci_sound', soundEnabled ? 'on' : 'off'); } catch(e) {}
  var el = document.getElementById('sound-toggle');
  if (el) el.textContent = soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
}
function playClick() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch(e) {}
}
// Init sound toggle display (deferred)
setTimeout(function() {
  var el = document.getElementById('sound-toggle');
  if (el) el.textContent = soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
}, 0);

// ── DAILY COMPLETION COUNT ──
function getCompletedToday() {
  try {
    var stored = JSON.parse(localStorage.getItem('luci_completed_daily') || '{"date":"","count":0}');
    var today = new Date().toISOString().slice(0, 10);
    if (stored.date !== today) {
      stored.date = today;
      stored.count = 0;
      localStorage.setItem('luci_completed_daily', JSON.stringify(stored));
    }
    return stored.count;
  } catch(e) { return 0; }
}
function incrementCompletedToday() {
  var c = getCompletedToday() + 1;
  try {
    localStorage.setItem('luci_completed_daily', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: c }));
  } catch(e) {}
  return c;
}
function decrementCompletedToday() {
  var c = Math.max(0, getCompletedToday() - 1);
  try {
    localStorage.setItem('luci_completed_daily', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: c }));
  } catch(e) {}
  return c;
}
function updateCompletedTodayDisplay(animate) {
  var c = getCompletedToday();
  var el = document.getElementById('completed-today-count');
  if (!el) return;
  if (c > 0) {
    el.textContent = c + ' closed today';
    el.className = 'completed-today' + (animate ? ' count-flash' : '');
    if (animate) setTimeout(function() { el.className = 'completed-today'; }, 300);
  } else {
    el.textContent = '';
    el.className = '';
  }
}
function setContextMessage(msg, duration) {
  var el = document.getElementById('context-message');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'count-flash';
  if (duration) {
    setTimeout(function() { el.textContent = ''; }, duration);
  }
}

// ── SOURCE LINK ──
function renderSourceLink(sourceRef) {
  if (!sourceRef) return '';
  var s = sourceRef.trim();
  if (s.toLowerCase().startsWith('granola:')) {
    var title = s.substring(8).trim();
    return '<a class="meta-tag source granola" href="#" onclick="event.stopPropagation();alert(\'Granola note: ' + escapeHtml(title) + '\')" title="' + escapeHtml(s) + '">\uD83D\uDCDD ' + escapeHtml(title.substring(0, 30)) + (title.length > 30 ? '...' : '') + '</a>';
  }
  if (s.toLowerCase().startsWith('email:')) {
    var subj = s.substring(6).trim();
    return '<a class="meta-tag source email" href="#" onclick="event.stopPropagation();alert(\'Email: ' + escapeHtml(subj) + '\')" title="' + escapeHtml(s) + '">\u2709\uFE0F ' + escapeHtml(subj.substring(0, 30)) + (subj.length > 30 ? '...' : '') + '</a>';
  }
  if (s.toLowerCase().startsWith('manual') || s.toLowerCase().includes('added manually')) {
    return '<span class="meta-tag source manual">\uD83D\uDCCB Manual</span>';
  }
  return '<span class="meta-tag source unknown">' + escapeHtml(s.substring(0, 20)) + '</span>';
}

// ── TASK TYPE INFERENCE ──
function getTaskType(text) {
  if (!text) return 'DO';
  var t = text.trim().toLowerCase();
  var draftStart = /^(draft|write|compose|send|email|respond|reply|circulate|forward|follow\s+up|reach\s+out|confirm\s+with|contact|call|message|text)\b/;
  var draftAny = /\b(send|email|respond|reply|contact|call|message|text)\b/;
  var trackStart = /^(track|monitor|review|verify|confirm\s+that|add\s+to|update)\b/;
  var trackAny = /\b(track|monitor|review|verify|confirm)\b/;

  if (draftStart.test(t)) return 'DRAFT';
  if (trackStart.test(t)) return 'TRACK';
  if (draftAny.test(t)) return 'DRAFT';
  if (trackAny.test(t)) return 'TRACK';
  return 'DO';
}

// ── QUICK FILTER TOGGLE ──
function toggleQuickFilter(name) {
  quickFilters[name] = !quickFilters[name];
  var el = document.getElementById('filter-' + name);
  if (el) el.classList.toggle('active');
  render();
}

// ── CSV EXPORT ──
function exportCSV() {
  var rows = [['Action Item','Owner','Status','Due Date','Project','Category','Firm','Hot Topic']];
  var filtered = getFilteredTasks();
  for (var i = 0; i < filtered.length; i++) {
    var t = filtered[i];
    rows.push([
      t.actionItem || '', t.owner || '', t.status || '', t.dueDate || '',
      t.project || '', t.category || '', t.responsibleFirm || '',
      t.hotTopic ? 'Yes' : ''
    ]);
  }
  var csv = rows.map(function(r) {
    return r.map(function(c) { return '"' + String(c).replace(/"/g,'""') + '"'; }).join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'luci-tasks-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── GET FILTERED TASKS (reusable for render + CSV) ──
function getFilteredTasks() {
  var q = searchText.toLowerCase().trim();
  return allTasks.filter(function(t) {
    if (t.status === 'Archived') return false;
    if (currentProject !== 'all' && t.project !== currentProject) return false;
    if (currentSource !== 'all' && t.source !== currentSource) return false;
    if (currentSourceRef && !t.sourceRef?.toLowerCase().includes(currentSourceRef.toLowerCase())) return false;
    if (currentCategory && t.category !== currentCategory) return false;
    if (currentStatus === 'open' && t.status !== 'Not Started' && t.status !== 'In Progress') return false;
    if (currentStatus === 'closed' && t.status !== 'Complete') return false;
    if (currentOwner && t.owner !== currentOwner) return false;
    if (currentSeries && t.seriesMasterId !== currentSeries) return false;
    if (quickFilters.mine && t.owner !== myName) return false;
    if (quickFilters.hot && !t.hotTopic) return false;
    if (quickFilters.overdue && !(t.status !== 'Complete' && isOverdue(t.dueDate))) return false;
    if (quickFilters.week && !(t.status !== 'Complete' && isThisWeek(t.dueDate))) return false;
    if (q) {
      var text = ((t.actionItem || '') + ' ' + (t.notes || '') + ' ' + (t.responsibleFirm || '')).toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

// ── FILTER + RENDER ──
function render() {
  var filtered = getFilteredTasks();

  // Sort: my tasks first, then overdue, then this week, then by date
  filtered.sort(function(a, b) {
    var aMine = a.owner === myName ? 0 : 1;
    var bMine = b.owner === myName ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;

    var aOver = isOverdue(a.dueDate) ? 0 : 1;
    var bOver = isOverdue(b.dueDate) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;

    var aWeek = a.status !== 'Complete' && isThisWeek(a.dueDate) ? 0 : 1;
    var bWeek = b.status !== 'Complete' && isThisWeek(b.dueDate) ? 0 : 1;
    if (aWeek !== bWeek) return aWeek - bWeek;

    var ad = a.dueDate || '9999-12-31';
    var bd = b.dueDate || '9999-12-31';
    return ad.localeCompare(bd);
  });

  // Render
  var list = document.getElementById('task-list');
  if (!list) return;
  list.innerHTML = '';

  for (var i = 0; i < filtered.length; i++) {
    var t = filtered[i];
    var isComplete = t.status === 'Complete';
    var over = !isComplete && isOverdue(t.dueDate);
    var cls = 'task' + (over ? ' overdue' : '') + (isComplete ? ' completed' : '');

    var dueDays = daysUntil(t.dueDate);
    var dueLabel = '';
    var dueClass = 'due';
    if (t.dueDate) {
      if (over) { dueLabel = dueDays === 0 ? 'Due today' : Math.abs(dueDays) + ' days overdue'; dueClass += ' overdue-tag'; }
      else if (dueDays === 0) { dueLabel = 'Due today'; dueClass += ' soon'; }
      else if (dueDays <= 3) { dueLabel = formatDate(t.dueDate) + ' (' + dueDays + 'd)'; dueClass += ' soon'; }
      else { dueLabel = formatDate(t.dueDate); }
    }

    var statusLabel = displayStatus(t.status);
    var statusClass = 'status' + (t.status === 'Complete' ? ' closed' : '');
    var firm = t.responsibleFirm || '';

    var div = document.createElement('div');
    div.className = cls;
    div.dataset.rowId = t.rowId;
    var discBadge = '';
    if (t.discussionCount > 0) {
      discBadge = '<span class="meta-tag disc" onclick="event.stopPropagation();toggleDiscussions(this,' + t.rowId + ')">\uD83D\uDCAC ' + t.discussionCount + '</span>';
    }
    var hotBadge = t.hotTopic && !isComplete ? '<span class="meta-tag hot">HOT</span>' : '';
    var unownedBadge = !t.owner && !isComplete ? '<span class="meta-tag unowned">no owner</span>' : '';
    var snHtml = '';
    if (t.statusNote) {
      snHtml = '<div class="status-note" onclick="event.stopPropagation();editStatusNote(this,' + t.rowId + ')">' + escapeHtml(t.statusNote) + '</div>';
    } else {
      snHtml = '<div class="status-note" onclick="event.stopPropagation();editStatusNote(this,' + t.rowId + ')" style="opacity:0.4;cursor:text">Add note...</div>';
    }
    div.dataset.source = t.source;
    var sourceText = t.source === 'personal' ? 'Personal' : t.source === 'staged' ? 'Staged' : '';
    var typeLabel = getTaskType(t.actionItem);
    var linkedHtml = t.source === 'personal' && t.linkedRowId
      ? '<span class="linked-row" onclick="event.stopPropagation();jumpToLinkedRow(' + t.linkedRowId + ')">\uD83D\uDD17</span>'
      : '';
    var deleteBtn = '<button class="task-delete" onclick="event.stopPropagation();deleteTask(this,' + t.rowId + ')" title="Delete">\u2715</button>';
    var dispatchState = getDispatchState(t);
    var canDispatch = true;
    var dLabel = 'LUCI';
    var dCls = 'task-dispatch' + (canDispatch ? ' dispatchable' : ' dispatch-disabled');
    if (dispatchState.state === 'dispatched') { dLabel = 'Sent'; dCls += ' dispatched'; }
    else if (dispatchState.state === 'working') { dLabel = 'Working'; dCls += ' working'; }
    else if (dispatchState.state === 'ready') { dLabel = 'Ready'; dCls += ' ready'; }
    else if (dispatchState.state === 'failed') { dLabel = 'Failed'; dCls += ' failed'; }
    var tip = canDispatch ? 'Dispatch to LUCI' : 'Auto-ingested - review in Smartsheet before dispatching';
    var dispatchBtnHtml = '<button class="' + dCls + '" data-row-id="' + t.rowId + '" data-source="' + (t.source || 'project') + '" data-type="' + typeLabel + '" title="' + tip + '"' +
      (dispatchState.disabled ? ' disabled' : '') +
      (canDispatch ? '' : ' disabled') + '>' + dLabel + '</button>';
    var draftBtnHtml = '';
    if (dispatchState.state === 'idle' && canDispatch && typeLabel !== 'DRAFT') {
      draftBtnHtml = '<button class="task-draft-btn" data-row-id="' + t.rowId + '" data-source="' + (t.source || 'project') + '" data-type="DRAFT" title="Request email draft">\u2709</button>';
    }
    var promoteBtnHtml = '';
    if (t.source === 'staged') {
      promoteBtnHtml = '<button class="task-promote" onclick="event.stopPropagation();promoteTask(this,' + t.rowId + ')" title="Promote to Project log">\u2191</button>';
    }
    div.innerHTML =
      '<div class="task-check' + (isComplete ? ' done' : '') + '" onclick="event.stopPropagation();toggleTask(this,' + t.rowId + ')">' +
        (isComplete ? '\u2713' : '') +
      '</div>' +
      '<div class="task-body">' +
        '<div class="task-title" onclick="event.stopPropagation();editTaskTitle(this,' + t.rowId + ')">' + escapeHtml(t.actionItem) + '</div>' +
        snHtml +
        '<div class="task-meta">' +
          (t.owner ? '<span class="meta-tag owner">' + escapeHtml(t.owner) + '</span>' : '') +
          (t.dueDate ? '<span class="meta-tag ' + dueClass + '">' + dueLabel + '</span>' : '') +
          (t.project ? '<span class="meta-tag project">' + escapeHtml(t.project) + '</span>' : '') +
          (firm ? '<span class="meta-tag firm">' + escapeHtml(firm) + '</span>' : '') +
          (statusLabel ? '<span class="meta-tag ' + statusClass + '" onclick="event.stopPropagation();cycleStatus(this,' + t.rowId + ')">' + escapeHtml(statusLabel) + '</span>' : '') +
          (sourceText ? '<span class="meta-tag">' + sourceText + '</span>' : '') +
          (typeLabel ? '<span class="meta-tag">' + typeLabel + '</span>' : '') +
          renderSourceLink(t.sourceRef) +
          hotBadge +
          unownedBadge +
          discBadge +
          linkedHtml +
        '</div>' +
        '<div class="disc-thread" id="disc-' + t.rowId + '"></div>' +
              '</div>' +
              '<div class="task-actions">' + promoteBtnHtml + dispatchBtnHtml + draftBtnHtml + deleteBtn + '</div>';
    list.appendChild(div);
  }

  // Counts
  var myTasks = allTasks.filter(function(t) { return t.owner === myName && t.status !== 'Complete'; }).length;
  var overdue = filtered.filter(function(t) { return isOverdue(t.dueDate) && t.status !== 'Complete'; }).length;
  var dueWeek = filtered.filter(function(t) { return isThisWeek(t.dueDate) && t.status !== 'Complete'; }).length;
  var unowned = filtered.filter(function(t) { return !t.owner && t.status !== 'Complete'; }).length;
  var countDisplay = document.getElementById('count-display');
  if (countDisplay) countDisplay.textContent = filtered.length + ' tasks';
  var myCountDisplay = document.getElementById('my-tasks-count');
  if (myCountDisplay) myCountDisplay.textContent = myTasks + ' mine' + (overdue ? '  |  \uD83D\uDD34 ' + overdue + ' overdue' : '') + (dueWeek ? '  |  ' + dueWeek + ' this week' : '') + (unowned ? '  |  ' + unowned + ' unowned' : '');
  updateCompletedTodayDisplay(false);
}

function getActionItem(rowId) {
  var t = allTasks.find(function(t) { return String(t.rowId) === String(rowId); });
  return t ? (t.actionItem || '').substring(0, 50) : 'Unknown';
}

// ── DATA LOADING ──
var rowSnapshots = {};
var pendingWrites = {};

function loadTasks() {
  var statusEl = document.getElementById('refresh-status');
  if (statusEl) statusEl.textContent = 'Loading...';
  var taskList = document.getElementById('task-list');
  if (taskList) taskList.classList.add('loading');

  fetch('/api/tasks')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allTasks = data.tasks || [];
      if (data.truncated) {
        var refEl = document.getElementById('refresh-status');
        if (refEl) {
          refEl.textContent = '\u26A0 Partial: ' + data.rowCount + ' of ' + data.totalInSheet + ' rows';
          refEl.style.color = '#e6c87c';
        }
      }
      rowSnapshots = {};
      allTasks.forEach(function(t) {
        rowSnapshots[t.rowId] = {
          actionItem: t.actionItem,
          owner: t.owner,
          status: t.status,
          dueDate: t.dueDate,
          project: t.project,
          category: t.category,
          responsibleFirm: t.responsibleFirm,
          statusNote: t.statusNote
        };
      });
      var conflicts = [];
      Object.keys(pendingWrites).forEach(function(rowId) {
        var pw = pendingWrites[rowId];
        var current = rowSnapshots[rowId];
        if (!current) return;
        Object.keys(pw.fields).forEach(function(field) {
          var writtenVal = pw.fields[field];
          var serverVal = current[field];
          if (serverVal !== writtenVal && String(serverVal || '') !== String(writtenVal || '')) {
            conflicts.push(pw.actionItem + ' (' + field + ')');
          }
        });
      });
      pendingWrites = {};
      if (conflicts.length > 0) {
        showToast('Conflict: ' + conflicts.join(', '), 4000);
      }
      // Populate owner filter
      var owners = new Set(allTasks.map(function(t) { return t.owner; }).filter(Boolean));
      var sel = document.getElementById('owner-filter');
      if (sel) {
        sel.innerHTML = '<option value="">All Owners</option>';
        var ownerArr = [];
        owners.forEach(function(o) { ownerArr.push(o); });
        ownerArr.sort().forEach(function(o) {
          sel.innerHTML += '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>';
        });
      }
      // Populate category filter
      var categories = new Set(allTasks.map(function(t) { return t.category; }).filter(Boolean));
      var catSel = document.getElementById('category-filter');
      if (catSel) {
        catSel.innerHTML = '<option value="">All Categories</option>';
        var catArr = [];
        categories.forEach(function(c) { catArr.push(c); });
        catArr.sort().forEach(function(c) {
          catSel.innerHTML += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
        });
      }
      // Populate series filter
      var seriesIds = new Set(allTasks.map(function(t) { return t.seriesMasterId; }).filter(Boolean));
      var seriesSel = document.getElementById('series-filter');
      if (seriesSel) {
        seriesSel.innerHTML = '<option value="">All Series</option>';
        var seriesArr = [];
        seriesIds.forEach(function(s) { seriesArr.push(s); });
        seriesArr.sort().forEach(function(s) {
          seriesSel.innerHTML += '<option value="' + escapeHtml(s) + '">' + escapeHtml(s.substring(0, 20)) + '...</option>';
        });
      }
      // Populate source/meeting filter
      var sourceRefs = new Set(allTasks.map(function(t) { return t.sourceRef; }).filter(Boolean));
      var srcSel = document.getElementById('source-filter');
      if (srcSel) {
        srcSel.innerHTML = '<option value="">All Sources</option>';
        var srcArr = [];
        sourceRefs.forEach(function(s) { srcArr.push(s); });
        srcArr.sort().forEach(function(s) {
          srcSel.innerHTML += '<option value="' + escapeHtml(s) + '">' + escapeHtml(s.substring(0, 45)) + '</option>';
        });
      }
      render();
      if (taskList) taskList.classList.remove('loading');
      var now = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
      var updatedEl = document.getElementById('updated-at');
      if (updatedEl) updatedEl.textContent = now;
      if (statusEl) statusEl.textContent = '';
      try { localStorage.setItem('luci_tasks_cache', JSON.stringify(data)); } catch(e) {}
    })
    .catch(function(err) {
      if (statusEl) statusEl.textContent = 'Error loading';
      if (taskList) taskList.classList.remove('loading');
      try {
        var cached = localStorage.getItem('luci_tasks_cache');
        if (cached) {
          var data = JSON.parse(cached);
          allTasks = data.tasks || [];
          render();
          var updatedEl = document.getElementById('updated-at');
          if (updatedEl) updatedEl.textContent = 'cached';
          if (statusEl) {
            statusEl.textContent = 'Offline (cached)';
            if (data.truncated) statusEl.textContent += ' \u26A0 Partial: ' + data.rowCount + ' of ' + data.totalInSheet;
          }
        }
      } catch(e) {}
    });
}

// ── CYCLE STATUS (inline, 3-state) ──
function cycleStatus(el, rowId) {
  var task = allTasks.find(function(t) { return String(t.rowId) === String(rowId); });
  if (!task) return;
  var raw = task.status || '';
  var next;
  if (raw === 'Not Started' || !raw) next = 'In Progress';
  else if (raw === 'In Progress') next = 'Complete';
  else next = 'Not Started';

  var taskEl = document.querySelector('.task[data-row-id="' + rowId + '"]');
  var source = taskEl ? taskEl.dataset.source || 'project' : 'project';
  pendingWrites[rowId] = { fields: { status: next } };
  fetch('/api/tasks/' + rowId + '?source=' + source, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: next })
  }).then(function(r) {
    if (!r.ok) throw new Error('save failed: ' + r.status);
    return r.json();
  }).then(function() {
    task.status = next;
    render();
    loadTasks();
  }).catch(function(e) {
    render();
    showToast('Could not save: ' + e.message, 3000);
  });
}

// ── TOGGLE TASK with animation on complete ──
function toggleTask(el, rowId) {
  var taskEl = el.closest('.task');
  var isDone = el.classList.contains('done');
  var task = allTasks.find(function(t) { return String(t.rowId) === String(rowId); });
  if (!task) return;
  var rawStatus = task.status || 'Not Started';
  var isClosed = rawStatus === 'Complete' || isDone;
  var becomingComplete = !isClosed;
  var prevStatus = rawStatus;

  // ---- REOPENING ----
  if (!becomingComplete) {
    el.classList.remove('done');
    el.innerHTML = '';
    taskEl.classList.remove('completed');
    var meta = taskEl.querySelector('.task-meta');
    var actions = taskEl.querySelector('.task-actions');
    var sn = taskEl.querySelector('.status-note');
    var ns = taskEl.querySelector('.note-suggestion');
    if (meta) meta.style.opacity = '';
    if (actions) actions.style.opacity = '';
    if (sn) sn.style.opacity = '';
    if (ns) ns.style.opacity = '';

    var source = taskEl.dataset.source || 'project';
    fetch('/api/tasks/' + rowId + '?source=' + source, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Not Started' })
    })
      .then(function(r) {
        if (!r.ok) {
          el.classList.add('done'); el.innerHTML = '\u2713'; taskEl.classList.add('completed');
          showToast('Revert failed', 2000);
        } else {
          task.status = 'Not Started';
          loadTasks();
        }
      })
      .catch(function() {
        el.classList.add('done'); el.innerHTML = '\u2713'; taskEl.classList.add('completed');
      });
    return;
  }

  // ---- COMPLETING: animated sequence ----
  playClick();

  // Step 1: Fill checkbox (CSS handles 150ms transition)
  el.classList.add('done');
  el.innerHTML = '\u2713';
  taskEl.classList.remove('overdue');

  // Step 2: After checkbox fills, add strikethrough + fade
  setTimeout(function() {
    taskEl.classList.add('completed');
    var meta = taskEl.querySelector('.task-meta');
    var actions = taskEl.querySelector('.task-actions');
    var sn = taskEl.querySelector('.status-note');
    var ns = taskEl.querySelector('.note-suggestion');
    if (meta) meta.style.opacity = '0.4';
    if (actions) actions.style.opacity = '0.4';
    if (sn) sn.style.opacity = '0.4';
    if (ns) ns.style.opacity = '0.4';

    var source = taskEl.dataset.source || 'project';
    fetch('/api/tasks/' + rowId + '?source=' + source, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Complete' })
    })
      .then(function(r) {
        if (!r.ok) {
          el.classList.remove('done');
          el.innerHTML = '';
          taskEl.classList.remove('completed');
          if (meta) meta.style.opacity = '';
          if (actions) actions.style.opacity = '';
          if (sn) sn.style.opacity = '';
          if (ns) ns.style.opacity = '';
          showToast('Toggle failed', 2000);
          return;
        }
        task.status = 'Complete';

        setTimeout(function() {
          taskEl.classList.add('collapsing');

          setTimeout(function() {
            taskEl.classList.remove('collapsing');
            taskEl.classList.add('collapsed');

            var count = incrementCompletedToday();
            updateCompletedTodayDisplay(true);

            var myTasks = allTasks.filter(function(t) { return t.owner === 'Whitney Williams' && t.status !== 'Complete'; });
            var stillOverdue = myTasks.filter(function(t) { return isOverdue(t.dueDate); });
            if (stillOverdue.length === 0) {
              setContextMessage('No overdue items', 3000);
            }
            var thisProj = task.project;
            if (thisProj) {
              var openInProj = myTasks.filter(function(t) { return t.project === thisProj; });
              if (openInProj.length === 0) {
                if (stillOverdue.length === 0) {
                  setContextMessage('No overdue items | ' + thisProj + ' clear', 3000);
                } else {
                  setContextMessage(thisProj + ' clear', 3000);
                }
              }
            }

            var myCount = myTasks.length;
            var myCountDisplay = document.getElementById('my-tasks-count');
            if (myCountDisplay) myCountDisplay.textContent = myCount + ' mine';

            showUndoToast(
              'Marked closed',
              function() {
                taskEl.classList.remove('collapsed');
                decrementCompletedToday();
                updateCompletedTodayDisplay(true);
                el.classList.remove('done');
                el.innerHTML = '';
                taskEl.classList.remove('completed');
                if (meta) meta.style.opacity = '';
                if (actions) actions.style.opacity = '';
                if (sn) sn.style.opacity = '';
                if (ns) ns.style.opacity = '';

                fetch('/api/tasks/' + rowId + '?source=' + source, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: prevStatus })
                })
                  .then(function(r2) {
                    if (r2.ok) {
                      task.status = prevStatus;
                      loadTasks();
                    } else {
                      showToast('Undo failed', 2000);
                      loadTasks();
                    }
                  })
                  .catch(function() { loadTasks(); });
              },
              function() {
                taskEl.remove();
                var idx = allTasks.indexOf(task);
                if (idx > -1) allTasks.splice(idx, 1);
                render();
              }
            );
          }, 320);
        }, 600);
      })
      .catch(function() {
        el.classList.remove('done');
        el.innerHTML = '';
        taskEl.classList.remove('completed');
        if (meta) meta.style.opacity = '';
        if (actions) actions.style.opacity = '';
        if (sn) sn.style.opacity = '';
        if (ns) ns.style.opacity = '';
      });
  }, 150);
}

// ── DISCUSSIONS + NOTES ──
var dismissHashes = {};
try {
  var stored = localStorage.getItem('luci_dismissed_notes');
  if (stored) dismissHashes = JSON.parse(stored);
} catch(e) {}

function generateNoteHash(text) {
  var s = text.trim().toLowerCase().replace(/\s+/g, ' ');
  var hash = 0;
  for (var i = 0; i < s.length; i++) { hash = ((hash << 5) - hash) + s.charCodeAt(i); hash |= 0; }
  return 'h' + Math.abs(hash);
}

function toggleDiscussions(el, rowId) {
  var thread = document.getElementById('disc-' + rowId);
  if (!thread) return;

  if (thread.classList.contains('open')) {
    thread.classList.remove('open');
    thread.innerHTML = '';
    return;
  }

  thread.innerHTML = '<div class="disc-load">Loading...</div>';
  thread.classList.add('open');
  thread.dataset.rowId = rowId;

  fetch('/api/tasks/' + rowId + '/discussions')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var discussions = data.discussions || [];
      var html = '';
      for (var i = 0; i < discussions.length; i++) {
        var d = discussions[i];
        var comments = d.comments || [];
        for (var j = 0; j < comments.length; j++) {
          var c = comments[j];
          var author = c.createdBy ? (c.createdBy.name || c.createdBy.email || '?') : '?';
          var ts = c.createdAt ? new Date(c.createdAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
          var text = c.text || '';
          html += '<div class="disc-msg"><span class="disc-author">' + escapeHtml(author) + '</span><span class="disc-time">' + ts + '</span><div class="disc-text">' + escapeHtml(text) + '</div></div>';
        }
      }
      html += '<div class="disc-input-row"><input class="disc-input" type="text" placeholder="Add note..." autocomplete="off"><button class="disc-post-btn">Post</button></div>';
      thread.innerHTML = html;

      var input = thread.querySelector('.disc-input');
      var btn = thread.querySelector('.disc-post-btn');
      function postNote() {
        var text = input.value.trim();
        if (!text) return;
        addNoteToRow(rowId, text, thread, input, btn);
      }
      btn.onclick = postNote;
      input.onkeydown = function(e) { if (e.key === 'Enter') { postNote(); } };
    })
    .catch(function() {
      thread.innerHTML = '<div class="disc-load">Failed to load</div>';
    });
}

function addNoteToRow(rowId, text, thread, input, btn) {
  var taskEl = document.querySelector('.task[data-row-id="' + rowId + '"]');
  var src = taskEl ? taskEl.dataset.source || 'project' : 'project';

  var noteHtml = '<div class="disc-msg"><span class="disc-author">You</span><span class="disc-time">now</span><div class="disc-text">' + escapeHtml(text) + '</div></div>';
  var inputRow = thread.querySelector('.disc-input-row');
  inputRow.insertAdjacentHTML('beforebegin', noteHtml);
  input.value = '';
  btn.disabled = true;

  fetch('/api/tasks/' + rowId + '/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.disabled = false;
      extractCommitmentFromNote(rowId, text, thread);
    })
    .catch(function() { btn.disabled = false; });
}

function extractCommitmentFromNote(rowId, noteText, thread) {
  var noteHash = generateNoteHash(noteText);
  if (dismissHashes[noteHash]) return;

  var parent = allTasks.find(function(t) { return String(t.rowId) === String(rowId); });
  if (!parent) return;

  fetch('/api/extract-from-note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: noteText,
      parentRowId: rowId,
      parentProject: parent.project || '',
      parentFirm: parent.responsibleFirm || ''
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.hasCommitment || !data.proposedTask) return;
      var task = data.proposedTask;

      var div = document.createElement('div');
      div.className = 'note-suggestion';
      div.dataset.noteHash = noteHash;
      div.innerHTML =
        '<div class="ns-icon">\uD83D\uDCCB</div>' +
        '<div class="ns-body">' +
          '<div class="ns-label">Looks like a new task:</div>' +
          '<div class="ns-task">' + escapeHtml(task.actionItem) + '</div>' +
          '<div class="ns-actions">' +
            '<button class="ns-btn ns-add" data-action="add">Add</button>' +
            '<button class="ns-btn ns-edit" data-action="edit">Edit then add</button>' +
            '<button class="ns-btn ns-dismiss" data-action="dismiss">Dismiss</button>' +
          '</div>' +
        '</div>';

      var msgs = thread.querySelectorAll('.disc-msg');
      var lastMsg = msgs[msgs.length - 1];
      if (lastMsg) {
        lastMsg.after(div);
      } else {
        var inputRow = thread.querySelector('.disc-input-row');
        if (inputRow) inputRow.before(div);
      }

      div.querySelector('[data-action="add"]').onclick = function() {
        div.querySelector('.ns-actions').innerHTML = '<span class="ns-working">Adding...</span>';
        addSuggestedTask(task, rowId, parent && parent.source === 'personal', div);
      };
      div.querySelector('[data-action="edit"]').onclick = function() {
        var taskText = div.querySelector('.ns-task');
        var input = document.createElement('input');
        input.className = 'ns-edit-input';
        input.type = 'text';
        input.value = taskText.textContent;
        taskText.replaceWith(input);
        input.focus();
        input.select();
        input.onkeydown = function(e) {
          if (e.key === 'Enter') {
            task.actionItem = input.value.trim();
            div.querySelector('.ns-actions').innerHTML = '<span class="ns-working">Adding...</span>';
            addSuggestedTask(task, rowId, parent && parent.source === 'personal', div);
          }
          if (e.key === 'Escape') { input.blur(); }
        };
        input.onblur = function() {
          task.actionItem = input.value.trim() || task.actionItem;
          div.querySelector('.ns-actions').innerHTML = '<span class="ns-working">Adding...</span>';
          addSuggestedTask(task, rowId, parent && parent.source === 'personal', div);
        };
      };
      div.querySelector('[data-action="dismiss"]').onclick = function() {
        dismissHashes[noteHash] = true;
        try { localStorage.setItem('luci_dismissed_notes', JSON.stringify(dismissHashes)); } catch(e) {}
        div.remove();
      };
    })
    .catch(function() {});
}

function addSuggestedTask(task, parentRowId, isPersonal, suggestionDiv) {
  if (isPersonal) {
    suggestionDiv.querySelector('.ns-body').innerHTML = '<div class="ns-label" style="color:var(--success)">Task added to Personal sheet</div>';
  } else {
    suggestionDiv.querySelector('.ns-body').innerHTML = '<div class="ns-label" style="color:var(--warn)">Staged for review - not yet written to project log</div>';
  }
}

// ── STATUS NOTE (inline edit) ──
function editStatusNote(el, rowId) {
  var currentText = el.textContent;
  var input = document.createElement('input');
  input.className = 'status-note-input';
  input.type = 'text';
  input.value = currentText;
  input.placeholder = 'Add status note...';
  el.replaceWith(input);
  input.focus();
  input.select();

  function save() {
    var newText = input.value.trim();
    var parent = input.closest('.task-body');

    var div = document.createElement('div');
    div.className = 'status-note';
    div.textContent = newText;
    div.onclick = function(e) { e.stopPropagation(); editStatusNote(this, rowId); };
    input.replaceWith(div);

    pendingWrites[rowId] = { actionItem: getActionItem(rowId), fields: { statusNote: newText } };

    var taskEl = input.closest('.task');
    var src = taskEl ? taskEl.dataset.source || 'project' : 'project';
    fetch('/api/tasks/' + rowId + '?source=' + src, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusNote: newText })
    }).then(function(r) {
      if (!r.ok) throw new Error('save failed: ' + r.status);
    }).catch(function(e) {
      div.textContent = currentText;
      showToast('Could not save status note: ' + e.message, 3000);
    });
  }

  input.onblur = save;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { save(); }
    if (e.key === 'Escape') { input.blur(); }
  };
}

// ── TASK TITLE (inline edit) ──
function editTaskTitle(el, rowId) {
  var currentText = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.style.cssText = 'background:#252525;border:1px solid #555;border-radius:var(--radius);padding:2px 6px;color:#d4d4d4;font-size:15.5px;width:100%;outline:none;font-family:var(--font)';
  input.value = currentText.trim() === 'Add note...' ? '' : currentText;
  input.placeholder = 'Edit task text...';
  el.replaceWith(input);
  input.focus();
  input.select();

  function save() {
    var newText = input.value.trim();
    var parent = input.closest('.task-body');
    var div = document.createElement('div');
    div.className = 'task-title';
    div.textContent = newText || currentText;
    div.style.cursor = 'pointer';
    if (newText && newText !== currentText) {
      pendingWrites[rowId] = { actionItem: getActionItem(rowId), fields: { actionItem: newText } };
      var taskEl = input.closest('.task');
      var src = taskEl ? taskEl.dataset.source || 'project' : 'project';
      fetch('/api/tasks/' + rowId + '?source=' + src, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItem: newText })
      }).then(function(r) {
        if (!r.ok) throw new Error('save failed: ' + r.status);
      }).catch(function(e) {
        div.textContent = currentText;
        showToast('Could not save: ' + e.message, 3000);
      });
    }
    input.replaceWith(div);
    div.onclick = function(e) { e.stopPropagation(); editTaskTitle(this, rowId); };
  }

  input.onblur = save;
  input.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { save(); }
  };
}

// ── DELETE TASK — confirm box, then immediate remove ──
function deleteTask(btnEl, rowId) {
  var taskEl = btnEl.closest('.task');
  var source = taskEl.dataset.source || 'project';
  var actionItem = getActionItem(rowId);

  confirmAction(
    'Delete "' + actionItem + '"?',
    'This cannot be undone. The row will be removed from the sheet.',
    function() {
      taskEl.remove();
      allTasks = allTasks.filter(function(t) { return String(t.rowId) !== String(rowId); });
      render();

      fetch('/api/tasks?source=' + source, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', rowId: String(rowId) })
      })
        .then(function(r) {
          if (!r.ok) {
            showToast('Delete failed \u2014 row may still exist', 3000);
          }
        })
        .catch(function() {
          showToast('Delete failed \u2014 row may still exist', 3000);
        });
    }
  );
}

// ── UNDO TOAST (5s auto-fire) ──
var undoTimeout = null;
function showUndoToast(message, onUndo, onTimeout) {
  if (undoTimeout) { clearTimeout(undoTimeout); undoTimeout = null; }
  var existing = document.querySelector('.undo-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = '<span>' + escapeHtml(message) + '</span><button id="undo-btn">Undo</button>';
  document.body.appendChild(toast);

  document.getElementById('undo-btn').onclick = function() {
    clearTimeout(undoTimeout);
    undoTimeout = null;
    toast.remove();
    if (onUndo) onUndo();
  };

  undoTimeout = setTimeout(function() {
    toast.remove();
    undoTimeout = null;
    if (onTimeout) onTimeout();
  }, 5000);
}

// ── SIMPLE TOAST (auto-dismiss, no undo) ──
function showToast(message, duration) {
  duration = duration || 3000;
  var toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = '<span>' + escapeHtml(message) + '</span>';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, duration);
}

// ── CONFIRMATION DIALOG ──
function confirmAction(text, subtext, onConfirm) {
  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML =
    '<div class="confirm-box">' +
      '<p class="confirm-text">' + escapeHtml(text) + '<br><span style="font-size:11px;color:var(--muted)">' + escapeHtml(subtext || '') + '</span></p>' +
      '<div class="confirm-actions">' +
        '<button class="confirm-btn cancel" id="confirm-cancel">Cancel</button>' +
        '<button class="confirm-btn danger" id="confirm-ok">Delete</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  document.getElementById('confirm-ok').onclick = function() {
    overlay.remove();
    onConfirm();
  };
  document.getElementById('confirm-cancel').onclick = function() { overlay.remove(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
}

// ── DISPATCH TO LUCI ──
function getDispatchState(task) {
  var note = (task.statusNote || '').toLowerCase();
  var state = 'idle';
  var disabled = false;
  if (note.indexOf('result ready') !== -1) {
    state = 'ready';
    disabled = true;
  } else if (note.indexOf('working') !== -1) {
    state = 'working';
    disabled = true;
  } else if (note.indexOf('dispatched') !== -1) {
    state = 'dispatched';
    disabled = true;
  } else if (note.indexOf('failed') !== -1) {
    state = 'failed';
    disabled = false;
  }
  return { state: state, disabled: disabled };
}

function dispatchTask(btn, rowId, source, type) {
  var state = getDispatchState({ statusNote: btn.parentElement.querySelector('.status-note') ? btn.parentElement.querySelector('.status-note').textContent : '' });
  if (state.state === 'dispatched' || state.state === 'working') return;

  btn.textContent = 'Sent';
  btn.className = 'task-dispatch dispatched';
  btn.disabled = true;

  fetch('/api/dispatch/' + rowId + '?source=' + source + '&type=' + (type || 'DO'), {
    method: 'POST'
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        btn.textContent = 'Sent';
        btn.className = 'task-dispatch dispatched';
        setTimeout(loadTasks, 2000);
      } else {
        btn.textContent = 'Failed';
        btn.className = 'task-dispatch failed';
        btn.disabled = false;
      }
    })
    .catch(function() {
      btn.textContent = 'Failed';
      btn.className = 'task-dispatch failed';
      btn.disabled = false;
    });
}

// ── JUMP TO LINKED ROW ──
function jumpToLinkedRow(linkedRowId) {
  currentSource = 'all';
  var chips = document.querySelectorAll('.source-chip');
  chips.forEach(function(c) { c.classList.remove('active'); });
  var allChip = document.querySelector('.source-chip[data-source="all"]');
  if (allChip) allChip.classList.add('active');
  render();
  setTimeout(function() {
    var el = document.querySelector('.task[data-row-id="' + linkedRowId + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ── POLLING STATE: pause while editing ──
var hasActiveInput = false;

// ── PROMOTE: Move staged item to Project log ──
function promoteTask(btnEl, rowId) {
  if (btnEl.classList.contains('working') || btnEl.classList.contains('promoted')) return;
  btnEl.classList.add('working');
  btnEl.textContent = '...';

  fetch('/api/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowId: String(rowId) })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.status === 'promoted') {
      btnEl.classList.remove('working');
      btnEl.classList.add('promoted');
      btnEl.textContent = '\u2713';
      setContextMessage('Promoted to Project log', 3000);
      setTimeout(function() { loadTasks(); }, 1500);
    } else {
      throw new Error(data.error || 'Promotion failed');
    }
  })
  .catch(function(err) {
    btnEl.classList.remove('working');
    btnEl.classList.add('failed');
    btnEl.textContent = '!';
    setContextMessage('Promote failed: ' + err.message, 4000);
  });
}

// ── FOCUS TRACKING ──
document.addEventListener('focusin', function() {
  var tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || document.activeElement?.contentEditable === 'true') {
    hasActiveInput = true;
  }
});
document.addEventListener('focusout', function() {
  hasActiveInput = false;
});

// ── PREP: Toggle detail section ──
function togglePrepDetail(eventId) {
  var el = document.getElementById('prep-detail-' + eventId);
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

// ── PREP: Switch tab ──
function switchPrepTab(eventId, tabName) {
  var detail = document.getElementById('prep-detail-' + eventId);
  if (!detail) return;
  var tabs = detail.querySelectorAll('.prep-detail-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var clicked = detail.querySelector('.prep-detail-tab[data-tab="' + tabName + '"]');
  if (clicked) clicked.classList.add('active');
  var panes = detail.querySelectorAll('.prep-tab-pane');
  panes.forEach(function(p) { p.classList.remove('active'); });
  var target = detail.querySelector('#prep-tab-' + tabName + '-' + eventId);
  if (target) target.classList.add('active');
}

// ── PREP: Copy & Print ──
function copyPrepPrint(eventId, subject, project) {
  var now = new Date();
  var dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  var text = project + ' | ' + subject + ' Agenda ' + dateStr + '\n';
  text += '='.repeat(40) + '\n\n';
  var detailEl = document.getElementById('prep-detail-' + eventId);
  if (detailEl) {
    var labels = detailEl.querySelectorAll('.prep-section-label');
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      text += label.textContent + '\n';
      var next = label.nextElementSibling;
      while (next && !next.classList.contains('prep-section-label') && !next.matches('button')) {
        if (next.style && next.style.margin) {
          text += '  ' + next.textContent.trim() + '\n';
        }
        next = next.nextElementSibling;
      }
      text += '\n';
    }
  }
  navigator.clipboard.writeText(text).then(function() {
    showToast('Copied to clipboard', 1500);
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Copied to clipboard', 1500);
  });
}

// ── PREP VIEW ──
function loadPrepView() {
  var v = document.getElementById('prep-view');
  if (!v) return;
  v.innerHTML = '<div class="prep-loading">Loading meeting prep...</div>';

  fetch('/api/prep')
    .then(function(r) {
      if (r.status === 401) throw new AuthRequiredError();
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (!data.events || data.events.length === 0) {
        v.innerHTML = '<div class="prep-empty">No upcoming meetings in the next 14 days.</div>';
        return;
      }
      renderPrepView(v, data.events);
    })
    .catch(function(err) {
      if (err instanceof AuthRequiredError) {
        v.innerHTML = '<div class="prep-error">' +
          'Calendar access requires Microsoft sign-in. ' +
          '<a href="/auth/login" class="prep-view-note-btn" style="text-decoration:none;display:inline-block;margin-top:8px">' +
          'Sign in with Microsoft</a></div>';
        return;
      }
      v.innerHTML = '<div class="prep-error">Failed to load: ' + escapeHtml(err.message) + '</div>';
    });
}

function AuthRequiredError() { this.name = 'AuthRequiredError'; }
AuthRequiredError.prototype = new Error();

function renderPrepView(container, events) {
  var now = new Date();
  var todayET = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  var futureEvents = [];
  var pastEvents = [];

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (!ev.start?.dateTime) continue;
    var eventDate = new Date(ev.start.dateTime).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    if (eventDate < todayET) {
      var msAgo = now - new Date(ev.start.dateTime);
      if (msAgo < 7 * 86400000) pastEvents.push(ev);
    } else {
      futureEvents.push(ev);
    }
  }

  var html = '';

  // ── TODAY & UPCOMING ──
  if (futureEvents.length > 0) {
    var groups = {};
    for (var i = 0; i < futureEvents.length; i++) {
      var ev = futureEvents[i];
      var day = ev.dateET || '';
      if (!day) continue;
      if (!groups[day]) groups[day] = [];
      groups[day].push(ev);
    }

    html += '<div class="prep-section-label" style="font-size:12px;font-weight:600;margin-bottom:8px">UPCOMING</div>';

    var dayKeys = Object.keys(groups);
    for (var di = 0; di < dayKeys.length; di++) {
      var dayLabel = dayKeys[di];
      var dayEvents = groups[dayLabel];
      var isToday = dayLabel.startsWith('Today');
      var isTomorrow = dayLabel.startsWith('Tomorrow');
      var displayDay = dayLabel;
      if (!isToday && !isTomorrow) {
        var parts = dayLabel.split(',');
        if (parts.length >= 2) {
          var weekday = new Date(dayEvents[0].start?.dateTime || dayLabel)
            .toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long' });
          displayDay = weekday + '  |  ' + parts.slice(1).join(',').trim();
        }
      }
      html += '<div class="prep-day-header' + (isToday ? ' today' : '') + '">' + escapeHtml(displayDay) + '</div>';
      html += '<div style="margin-bottom:6px">';

      for (var ei = 0; ei < dayEvents.length; ei++) {
        html += renderPrepCard(dayEvents[ei]);
      }
      html += '</div>';
    }
  }

  // ── EARLIER THIS WEEK ──
  if (pastEvents.length > 0) {
    html += '<div class="prep-past-section">';
    html += '<div class="prep-past-header" id="prep-past-header" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:600;padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">';
    html += '  <span id="prep-past-chevron">\u25B6</span>';
    html += '  <span>Earlier This Week (' + pastEvents.length + ' meeting' + (pastEvents.length !== 1 ? 's' : '') + ')</span>';
    html += '</div>';
    html += '<div id="prep-past-body" style="display:none">';

    var pastGroups = {};
    for (var i = 0; i < pastEvents.length; i++) {
      var ev = pastEvents[i];
      var day = ev.dateET || '';
      if (!day) continue;
      if (!pastGroups[day]) pastGroups[day] = [];
      pastGroups[day].push(ev);
    }
    var pastDays = Object.keys(pastGroups).sort(function(a, b) {
      var dateA = new Date(pastGroups[a][0]?.start?.dateTime || 0);
      var dateB = new Date(pastGroups[b][0]?.start?.dateTime || 0);
      return dateB - dateA;
    });

    for (var pi = 0; pi < pastDays.length; pi++) {
      var dayLabel = pastDays[pi];
      var dayEvs = pastGroups[dayLabel];
      var parts = dayLabel.split(',');
      var displayDay = dayLabel;
      if (parts.length >= 2) {
        displayDay = parts.slice(1).join(',').trim();
      }
      html += '<div class="prep-day-header" style="font-size:11px;opacity:0.7;padding:4px 0">' + escapeHtml(displayDay) + '</div>';

      for (var ej = 0; ej < dayEvs.length; ej++) {
        dayEvs[ej]._isPast = true;
        html += renderPrepCard(dayEvs[ej]);
      }
    }

    html += '</div>';
    html += '</div>';
  }

  if (futureEvents.length === 0 && pastEvents.length === 0) {
    html = '<div class="prep-empty">No meetings in the next 14 days.</div>';
  }

  container.innerHTML = html;

  var pastHeader = document.getElementById('prep-past-header');
  if (pastHeader) {
    pastHeader.addEventListener('click', function(e) {
      var body = document.getElementById('prep-past-body');
      var chevron = document.getElementById('prep-past-chevron');
      if (!body) return;
      var visible = body.style.display !== 'none';
      body.style.display = visible ? 'none' : 'block';
      if (chevron) chevron.innerHTML = visible ? '\u25B6' : '\u25BC';
    });
  }
}

// ── RENDER A SINGLE PREP CARD ──
function renderPrepCard(ev) {
  var hasNote = ev.hasGranolaNote;
  var isOneOff = !ev.isRecurring;
  var isPast = ev._isPast;
  var cardClass = 'prep-card' + (hasNote ? ' has-note' : '') + (isPast ? ' prep-card-past' : '');
  var projectBadge = ev.project ? ' <span class="meta-tag project" style="font-size:10px;padding:0 4px">' + escapeHtml(ev.project) + '</span>' : '';
  var eventId = escapeHtml(ev.eventId || 'no-id');
  var detailId = 'prep-detail-' + eventId;

  var h = '<div class="' + cardClass + '" style="padding:6px 10px;margin-bottom:6px;cursor:pointer" data-event-id="' + eventId + '">';
  h += '<div class="prep-header" style="margin-bottom:3px">';
  h += '  <div class="prep-title" style="font-size:14px">' + escapeHtml(ev.subject) + projectBadge + '</div>';
  h += '  <div class="prep-time" style="font-size:12px">' + escapeHtml(isPast ? ev.dateET : (ev.timeET || '')) + '</div>';
  h += '</div>';

  h += '<div class="prep-meta" style="margin-bottom:4px;font-size:11px">';
  if (ev.location) h += '<span class="prep-loc">' + escapeHtml(ev.location) + '</span>';
  if (ev.attendees && ev.attendees.length > 0) h += '<span style="color:var(--muted)">' + ev.attendees.length + ' attendees</span>';
  h += '</div>';

  if (hasNote) {
    if (ev.summaryPreview) {
      var truncated = ev.summaryPreview.length > 350;
      var display = truncated ? escapeHtml(ev.summaryPreview.substring(0, 350)) + '...' : escapeHtml(ev.summaryPreview);
      h += '<div class="prep-summary" id="prep-sum-' + eventId + '" style="max-height:150px">' + display + '</div>';
      if (truncated) {
        h += '<span class="prep-summary-expand" onclick="event.stopPropagation();void function(){var el=document.getElementById(\'prep-sum-' + eventId + '\');el.classList.toggle(\'expanded\');this.textContent=this.textContent==\'Show more\'?\'Show less\':\'Show more\';}()">Show more</span>';
      }
    }
    if (ev.granolaStaleDays && ev.granolaStaleDays > 30) {
      h += '<div style="font-size:11px;color:var(--warn);margin-top:2px">Note from ' + escapeHtml(ev.granolaNoteDate || '') + ' (' + ev.granolaStaleDays + ' days ago)</div>';
    }
    if (ev.actionItems && ev.actionItems.length > 0) {
      h += '<div class="prep-section-label" style="margin-top:6px;font-size:10px">Open Action Items</div>';
      for (var ai = 0; ai < ev.actionItems.length; ai++) {
        var item = ev.actionItems[ai];
        h += '<div class="prep-action-item" style="font-size:12px;padding:2px 0">';
        h += '  <span class="prep-action-assignee" style="font-size:10px">' + escapeHtml(item.assignees[0]) + '</span>';
        h += '  <span class="prep-action-text">' + escapeHtml(item.text) + '</span>';
        h += '</div>';
      }
    }
    if (ev.granolaWebUrl) {
      h += '<a href="' + escapeHtml(ev.granolaWebUrl) + '" target="_blank" class="prep-view-note-btn" style="text-decoration:none;display:inline-block;font-size:10px">View in Granola</a>';
    }
  } else if (isOneOff) {
    // one-off: no note expected
  } else if (ev.neverHadNote) {
    h += '<div class="prep-no-note" style="font-size:11px;padding:2px 0;font-style:italic;color:var(--muted)">No meeting notes for this series.</div>';
  }

  // Detail sections
  h += '<div id="' + detailId + '" style="display:none;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">';
  h += '<div class="prep-detail-tabs">';
  h += '  <button class="prep-detail-tab active" data-tab="agenda" onclick="event.stopPropagation();switchPrepTab(\'' + eventId + '\',\'agenda\')">AGENDA</button>';
  h += '  <button class="prep-detail-tab" data-tab="notes" onclick="event.stopPropagation();switchPrepTab(\'' + eventId + '\',\'notes\')">NOTES</button>';
  h += '</div>';

  h += '<div class="prep-tab-pane active" id="prep-tab-agenda-' + eventId + '">';
  if (ev.owedItems && ev.owedItems.length > 0) {
    h += '<div class="prep-section-label" style="margin-top:6px;font-size:10px">OWED TO ME</div>';
    var ownerGroups = {};
    for (var oi = 0; oi < ev.owedItems.length; oi++) {
      var item = ev.owedItems[oi];
      var key = item.owner || 'Unassigned';
      if (!ownerGroups[key]) ownerGroups[key] = [];
      ownerGroups[key].push(item);
    }
    var ownerKeys = Object.keys(ownerGroups);
    for (var ok = 0; ok < ownerKeys.length; ok++) {
      var owner = ownerKeys[ok];
      var items = ownerGroups[owner];
      var ownerDisplay = owner === 'Unassigned' ? '---' : owner;
      h += '<div style="margin:2px 0">';
      h += '  <span style="font-size:11px;font-weight:500;color:var(--accent)">' + escapeHtml(ownerDisplay) + '</span>';
      for (var oi2 = 0; oi2 < items.length; oi2++) {
        var item = items[oi2];
        var dueLabel = item.dueDate ? ' | due ' + item.dueDate : '';
        h += '  <div style="font-size:12px;padding:1px 0 1px 12px;color:var(--fg)">' + escapeHtml(item.actionItem) + (dueLabel ? '<span style="color:var(--muted);font-size:11px">' + dueLabel + '</span>' : '') + '</div>';
      }
      h += '</div>';
    }
  }

  if (ev.whitneyItems && ev.whitneyItems.length > 0) {
    h += '<div class="prep-section-label" style="margin-top:6px;font-size:10px">WHAT I OWE</div>';
    for (var wi = 0; wi < ev.whitneyItems.length; wi++) {
      var item = ev.whitneyItems[wi];
      var dueLabel = item.dueDate ? ' | due ' + item.dueDate : '';
      h += '<div style="font-size:12px;padding:1px 0;color:var(--fg)">' + escapeHtml(item.actionItem) + (dueLabel ? '<span style="color:var(--muted);font-size:11px">' + dueLabel + '</span>' : '') + '</div>';
    }
  }

  if (ev.pastNotes && ev.pastNotes.length > 0) {
    var allSeriesItems = (ev.owedItems || []).concat(ev.whitneyItems || []);
    if (allSeriesItems.length > 0) {
      var carriedItems = [];
      for (var pn = 0; pn < ev.pastNotes.length; pn++) {
        var pnItem = ev.pastNotes[pn];
        if (!pnItem.actionItems) continue;
        for (var aii = 0; aii < pnItem.actionItems.length; aii++) {
          var ai = pnItem.actionItems[aii];
          var stillOpen = allSeriesItems.some(function(oi) {
            return oi.actionItem.toLowerCase().includes(ai.text.toLowerCase().substring(0, 30));
          });
          if (stillOpen) {
            var existing = carriedItems.find(function(c) { return c.text === ai.text; });
            if (!existing) {
              carriedItems.push({ text: ai.text, assignee: ai.assignees[0], firstSeen: pnItem.date });
            }
          }
        }
      }
      if (carriedItems.length > 0) {
        h += '<div class="prep-section-label" style="margin-top:6px;font-size:10px">CARRIED OVER</div>';
        for (var ci = 0; ci < carriedItems.length; ci++) {
          var cItem = carriedItems[ci];
          h += '<div class="prep-action-item" style="font-size:12px;padding:2px 0">';
          h += '  <span class="prep-action-assignee" style="font-size:10px">' + escapeHtml(cItem.assignee) + '</span>';
          h += '  <span class="prep-action-text">' + escapeHtml(cItem.text) + '</span>';
          h += '</div>';
        }
      }
    }
  }

  h += '<button class="prep-view-note-btn" style="margin-top:6px" onclick="event.stopPropagation();copyPrepPrint(\'' + eventId + '\', \'' + escapeHtml(ev.subject) + '\', \'' + escapeHtml(ev.project) + '\')">Copy & Print</button>';
  h += '</div>'; // end AGENDA pane

  h += '<div class="prep-tab-pane" id="prep-tab-notes-' + eventId + '">';
  if (ev.summaryMarkdown) {
    h += '<div class="prep-notes-content">' + escapeHtml(ev.summaryMarkdown) + '</div>';
    if (ev.granolaWebUrl) {
      h += '<a href="' + escapeHtml(ev.granolaWebUrl) + '" target="_blank" class="prep-view-note-btn" style="text-decoration:none;display:inline-block;font-size:10px;margin-top:4px">View in Granola</a>';
    }
  } else {
    h += '<div class="prep-no-note" style="font-size:11px;padding:2px 0;font-style:italic;color:var(--muted)">No meeting notes for this meeting.</div>';
  }
  h += '</div>'; // end NOTES pane

  h += '</div>'; // end detail section
  h += '</div>'; // end card
  return h;
}

// Toggle "Earlier This Week" past meetings section
function togglePastPrep() {
  var body = document.getElementById('prep-past-body');
  var chevron = document.getElementById('prep-past-chevron');
  if (!body) return;
  var visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : 'block';
  if (chevron) chevron.innerHTML = visible ? '\u25B6' : '\u25BC';
}

// ── EVENT BINDING ──

// Tabs
var tabsEl = document.getElementById('project-tabs');
if (tabsEl) {
  tabsEl.addEventListener('click', function(e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    var project = tab.dataset.project;

    if (project === 'prep') {
      var allTabs = document.querySelectorAll('.tab');
      allTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var taskList = document.getElementById('task-list');
      var filters = document.querySelector('.filters');
      var chips = document.querySelector('.source-chips');
      var prepView = document.getElementById('prep-view');
      if (taskList) taskList.style.display = 'none';
      if (filters) filters.style.display = 'none';
      if (chips) chips.style.display = 'none';
      if (prepView) prepView.classList.add('active');
      loadPrepView();
      return;
    }

    var allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    var taskList = document.getElementById('task-list');
    var filters = document.querySelector('.filters');
    var chips = document.querySelector('.source-chips');
    var prepView = document.getElementById('prep-view');
    if (taskList) taskList.style.display = '';
    if (filters) filters.style.display = '';
    if (chips) chips.style.display = '';
    if (prepView) prepView.classList.remove('active');
    currentProject = project;
    render();
  });
}

// Reset all filters
function resetFilters() {
  currentProject = 'all';
  currentCategory = '';
  currentStatus = 'open';
  currentOwner = '';
  currentSeries = '';
  currentSource = 'all';
  currentSourceRef = '';
  searchText = '';
  quickFilters = { overdue: false, week: false, hot: false, mine: false };
  var searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
  document.querySelectorAll('.dm-select').forEach(function(s) { s.value = ''; });
  // Re-set status filter to open
  var statusSel = document.getElementById('status-filter');
  if (statusSel) statusSel.value = 'open';
  var srcSel = document.getElementById('source-filter');
  if (srcSel) srcSel.value = '';
  render();
}

// Search
var searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', function() {
    searchText = this.value;
    render();
  });
}

// Status filter
var statusFilter = document.getElementById('status-filter');
if (statusFilter) {
  statusFilter.addEventListener('change', function() {
    currentStatus = this.value;
    render();
  });
}

// Category filter
var categoryFilter = document.getElementById('category-filter');
if (categoryFilter) {
  categoryFilter.addEventListener('change', function() {
    currentCategory = this.value;
    render();
  });
}

// Owner filter
var ownerFilter = document.getElementById('owner-filter');
if (ownerFilter) {
  ownerFilter.addEventListener('change', function() {
    currentOwner = this.value;
    render();
  });
}

// Series filter
var seriesFilter = document.getElementById('series-filter');
if (seriesFilter) {
  seriesFilter.addEventListener('change', function() {
    currentSeries = this.value;
    render();
  });
}

// Source/meeting filter
var sourceFilter = document.getElementById('source-filter');
if (sourceFilter) {
  sourceFilter.addEventListener('change', function() {
    currentSourceRef = this.value;
    render();
  });
}

// Source chips
var sourceChips = document.querySelectorAll('.source-chip');
sourceChips.forEach(function(chip) {
  chip.addEventListener('click', function() {
    document.querySelectorAll('.source-chip').forEach(function(c) { c.classList.remove('active'); });
    this.classList.add('active');
    currentSource = this.dataset.source;
    render();
  });
});

// Delegated dispatch click handler
var taskListEl = document.getElementById('task-list');
if (taskListEl) {
  taskListEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.task-dispatch.dispatchable');
    if (!btn) return;
    if (btn.disabled) return;
    e.stopPropagation();
    var rowId = btn.dataset.rowId;
    var source = btn.dataset.source || 'project';
    var type = btn.dataset.type || 'DO';
    dispatchTask(btn, rowId, source, type);
  });
}

// Delegated Draft button click handler
if (taskListEl) {
  taskListEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.task-draft-btn');
    if (!btn) return;
    if (btn.disabled) return;
    e.stopPropagation();
    var rowId = btn.dataset.rowId;
    var source = btn.dataset.source || 'project';
    dispatchTask(btn, rowId, source, 'DRAFT');
  });
}

// Initial load from cache then fetch
try {
  var cached = localStorage.getItem('luci_tasks_cache');
  if (cached) {
    var data = JSON.parse(cached);
    allTasks = data.tasks || [];
    render();
    var taskList = document.getElementById('task-list');
    if (taskList) taskList.classList.remove('loading');
    var updatedEl = document.getElementById('updated-at');
    if (updatedEl) updatedEl.textContent = 'cached';
  }
} catch(e) {}
loadTasks();

// Auto-refresh every 60 seconds, skip while editing
var refreshInterval = setInterval(function() {
  if (hasActiveInput) return;
  var statusEl = document.getElementById('refresh-status');
  if (statusEl) statusEl.textContent = '\u27F3';
  fetch('/api/tasks')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allTasks = data.tasks || [];
      var owners = new Set(allTasks.map(function(t) { return t.owner; }).filter(Boolean));
      var sel = document.getElementById('owner-filter');
      if (sel) {
        var curOwner = sel.value;
        sel.innerHTML = '<option value="">All Owners</option>';
        var ownerArr = [];
        owners.forEach(function(o) { ownerArr.push(o); });
        ownerArr.sort().forEach(function(o) {
          sel.innerHTML += '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>';
        });
        if (curOwner) sel.value = curOwner;
      }
      var categories = new Set(allTasks.map(function(t) { return t.category; }).filter(Boolean));
      var catSel = document.getElementById('category-filter');
      if (catSel) {
        var curCat = catSel.value;
        catSel.innerHTML = '<option value="">All Categories</option>';
        var catArr = [];
        categories.forEach(function(c) { catArr.push(c); });
        catArr.sort().forEach(function(c) {
          catSel.innerHTML += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
        });
        if (curCat) catSel.value = curCat;
      }
      render();
      var taskList = document.getElementById('task-list');
      if (taskList) taskList.classList.remove('loading');
      var updatedEl = document.getElementById('updated-at');
      if (updatedEl) updatedEl.textContent = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
      if (statusEl) statusEl.textContent = '';
      try { localStorage.setItem('luci_tasks_cache', JSON.stringify(data)); } catch(e) {}
    })
    .catch(function() {
      if (statusEl) statusEl.textContent = '';
    });
}, 60000);

// Delegated click handler for prep cards
document.addEventListener('click', function(e) {
  var card = e.target.closest('[data-event-id]');
  if (!card) return;
  var eventId = card.getAttribute('data-event-id');
  if (eventId) togglePrepDetail(eventId);
});

// Return the refresh interval so the caller can clear it when leaving the view

// Expose critical functions globally for inline onclick handlers
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.editTaskTitle = editTaskTitle;
window.promoteTask = promoteTask;
window.toggleDiscussions = toggleDiscussions;
window.editStatusNote = editStatusNote;
window.cycleStatus = cycleStatus;
window.jumpToLinkedRow = jumpToLinkedRow;
window.copyPrepPrint = copyPrepPrint;
window.switchPrepTab = switchPrepTab;

return refreshInterval;
} catch(e) { console.error('renderDailyManager error:', e); }
} // end renderDailyManager()