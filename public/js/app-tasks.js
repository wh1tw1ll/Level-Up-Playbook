// ── TASKS VIEW — Renders the full daily manager inline ──
// Builds the HTML for the daily manager widget container and renders tasks

function renderTasksView() {
  var container = document.getElementById('tasks-widget');
  if (!container) return;

  // Inject the daily manager HTML structure
  container.innerHTML = 
    '<div class="dm-header">' +
      '<div class="dm-header-left">' +
        '<div class="dm-title">📋 Action Items</div>' +
        '<div class="dm-controls">' +
          '<div class="dm-filters">' +
            '<button id="filter-overdue" class="filter-chip" onclick="toggleQuickFilter(\'overdue\')" title="Overdue only">🔴 Overdue</button>' +
            '<button id="filter-week" class="filter-chip" onclick="toggleQuickFilter(\'week\')" title="Due this week">📅 This Week</button>' +
            '<button id="filter-hot" class="filter-chip" onclick="toggleQuickFilter(\'hot\')" title="Hot topics only">🔥 Hot</button>' +
            '<button id="filter-mine" class="filter-chip" onclick="toggleQuickFilter(\'mine\')" title="My tasks only">👤 Mine</button>' +
            '<button id="sound-toggle" class="dm-icon-btn" onclick="toggleSound()" title="Toggle sound">🔇</button>' +
            '<button class="dm-icon-btn" onclick="exportCSV()" title="Export CSV">⬇</button>' +
            '<button class="dm-icon-btn dm-reset" onclick="resetFilters()" title="Reset filters">✕</button>' +
          '</div>' +
          '<div class="dm-filter-row">' +
            '<select id="status-filter" class="dm-select">' +
              '<option value="open">Open</option>' +
              '<option value="all">All</option>' +
              '<option value="closed">Closed</option>' +
            '</select>' +
            '<select id="owner-filter" class="dm-select"><option value="">All Owners</option></select>' +
            '<select id="category-filter" class="dm-select"><option value="">All Categories</option></select>' +
            '<select id="series-filter" class="dm-select"><option value="">All Series</option></select>' +
            '<select id="source-filter" class="dm-select"><option value="">All Sources</option></select>' +
            '<input id="search-input" class="dm-search" type="text" placeholder="Search tasks...">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="dm-header-right">' +
        '<span id="count-display" class="dm-count"></span>' +
        '<span id="my-tasks-count" class="dm-mine"></span>' +
        '<span id="completed-today-count" class="completed-today"></span>' +
        '<span id="context-message" class="context-message"></span>' +
        '<span id="refresh-status" class="refresh-status"></span>' +
        '<span id="updated-at" class="updated-at"></span>' +
      '</div>' +
    '</div>' +
    '<div class="dm-body">' +
      '<div class="dm-new-task-bar">' +
        '<button class="dm-new-task-btn" onclick="toggleNewTaskForm()" title="Add a new task">+ New Task</button>' +
        '<div id="new-task-form" class="new-task-form" style="display:none">' +
          '<div class="ntf-row">' +
            '<input id="ntf-title" class="ntf-input ntf-title-input" type="text" placeholder="Task title (required)" autocomplete="off">' +
          '</div>' +
          '<div class="ntf-row ntf-fields">' +
            '<select id="ntf-project" class="ntf-select"><option value="">Project</option><option value="MFP">MFP</option><option value="DOVA">DOVA</option><option value="Business Dev">Business Dev</option><option value="KC Chiefs">KC Chiefs</option><option value="Sphere">Sphere</option></select>' +
            '<select id="ntf-category" class="ntf-select"><option value="">Category</option><option value="Coordination">Coordination</option><option value="Design">Design</option><option value="Procurement">Procurement</option><option value="Submittal">Submittal</option><option value="RFI">RFI</option><option value="Budget">Budget</option><option value="Schedule">Schedule</option><option value="Closeout">Closeout</option><option value="General">General</option></select>' +
            '<input id="ntf-owner" class="ntf-input" type="text" placeholder="Owner" autocomplete="off">' +
            '<input id="ntf-due" class="ntf-input ntf-date" type="date" placeholder="Due date">' +
          '</div>' +
          '<div class="ntf-actions">' +
            '<button class="ntf-submit" onclick="submitNewTask()">Add Task</button>' +
            '<button class="ntf-cancel" onclick="hideNewTaskForm()">Cancel</button>' +
            '<span id="ntf-status" class="ntf-status"></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="project-tabs" class="project-tabs"></div>' +
      '<div id="task-list" class="task-list"></div>' +
      '<div id="prep-view" class="prep-view" style="display:none"></div>' +
    '</div>' +
    '<div id="undo-btn" class="undo-btn" style="display:none"></div>' +
    '<div id="confirm-overlay" class="confirm-overlay" style="display:none">' +
      '<div class="confirm-box">' +
        '<div id="confirm-msg" class="confirm-msg"></div>' +
        '<div class="confirm-actions">' +
          '<button id="confirm-ok" class="confirm-btn ok">OK</button>' +
          '<button id="confirm-cancel" class="confirm-btn cancel">Cancel</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // Call the full daily manager which expects these elements in the DOM
  if (typeof renderDailyManager === 'function') {
    renderDailyManager();
  }
}

// ── PREP VIEW — Renders the full prep view (overridden by app-prep.js) ──
function renderPrepView() {
  // app-prep.js overrides this; this is just a fallback
  var container = document.getElementById('view-prep');
  if (!container) return;
  container.innerHTML =
    '<div class="view-header">' +
      '<div class="view-title"><span>🎯</span> Prep — Meeting Notes & Agenda</div>' +
    '</div>' +
    '<div class="prep-container"><div style="padding:60px;text-align:center;color:var(--muted)">Loading Prep...</div></div>';
  // If app-prep.js has loaded, it will have replaced this function
  if (typeof window.renderPrepViewImpl === 'function') {
    window.renderPrepViewImpl();
  }
}