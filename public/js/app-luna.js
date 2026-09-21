// ── LUNA APP: hero, chat, clippy, reminders, briefing, init ──
// These are the live interactive functions extracted from app.js v20260612
// Depends on: app-core.js (state, helpers, modals, auth, theme)
// Utility functions (escapeHtml, fmtNum, jsCallArg, isOverdue, isDueToday)
// are defined in app-core.js and available globally.

// ── LUNA RESPONSE FORMATTER ───────────────────────────────────
// Converts markdown links to clickable navigation in the Playbook
function formatLunaResponse(text) {
  if (!text) return '';
  var html = escapeHtml(text);
  // Convert [text](template:key) → click to open Templates tab
  html = html.replace(/\[([^\]]+)\]\(template:([^)]+)\)/g,
    '<a href="#" onclick="setView(\'templates\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](section:num) → click to open Playbook at section
  html = html.replace(/\[([^\]]+)\]\(section:(\d+)\)/g,
    '<a href="#" onclick="setView(\'playbook\');jumpTo(\'$2\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](templates) → click to open Templates tab
  html = html.replace(/\[([^\]]+)\]\(templates\)/g,
    '<a href="#" onclick="setView(\'templates\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](playbook) → click to open Playbook tab
  html = html.replace(/\[([^\]]+)\]\(playbook\)/g,
    '<a href="#" onclick="setView(\'playbook\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](projects) → click to open Projects tab
  html = html.replace(/\[([^\]]+)\]\(projects\)/g,
    '<a href="#" onclick="setView(\'projects\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert external markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" style="color:var(--teal);text-decoration:underline">$1</a>');
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ── SUMMON LUNA (Help button fly-in) ──────────────────────────────
function summonLuna() {
  var clippy = document.getElementById('luna-clippy');
  var btn = document.getElementById('help-btn');
  if (!clippy) return;
  // If already visible, just open the chat
  if (clippy.style.display !== 'none' && clippy.style.display !== '') {
    clippyClick();
    return;
  }
  // Remove any existing animation class
  clippy.classList.remove('luna-fly-in');
  // Show it but off-screen right
  clippy.style.display = 'block';
  // Force reflow, then trigger fly-in
  void clippy.offsetWidth;
  clippy.classList.add('luna-fly-in');
  // Hide the help button after summoning
  if (btn) btn.style.display = 'none';
}

function dismissLuna() {
  clippyTab();
}

// ── LUNA CLIPPY ────────────────────────────────────────────────────
var clippyState = 'full'; // 'full' | 'tab' | 'chat_open'
var clippySuggestions = [
  "Need to review a change order?",
  "Ask me about the project budget.",
  "Looking for a subcontractor?",
  "Check the latest MFP status.",
  "Need a template for a meeting?",
  "Ask me about punch list closeout."
];
var clippySuggestionTimer = null;

function clippyClick() {
  // If clippy is in tab mode, expand first
  if (clippyState === 'tab') {
    clippyExpand(); return;
  }
  // If the user just dragged the icon, don't open chat
  if (window.__clippyDragDist && window.__clippyDragDist() > 8) {
    return;
  }
  // Hide any suggestion
  hideClippySuggestion();
  // Position chat drawer near clippy before opening
  var clippy = document.getElementById('luna-clippy');
  var drawer = document.getElementById('chat-drawer');
  if (clippy && drawer && clippy.classList.contains('dragged')) {
    var cr = clippy.getBoundingClientRect();
    // Open the drawer above and slightly left of the icon
    drawer.style.left = Math.max(16, cr.left - 200) + 'px';
    drawer.style.top = Math.max(16, cr.top - 450) + 'px';
    drawer.style.right = 'auto';
    drawer.style.bottom = 'auto';
  }
  // Open chat
  toggleChat();
}

function clippyExpand() {
  clippyState = 'full';
  var clippy = document.getElementById('luna-clippy');
  var tab = document.getElementById('clippy-tab-standalone');
  if (clippy) { clippy.style.display = 'block'; clippy.classList.remove('tab-mode'); }
  if (tab) tab.style.display = 'none';
  // Reset suggestion timer
  scheduleClippySuggestion();
}

function clippyTab() {
  clippyState = 'tab';
  var clippy = document.getElementById('luna-clippy');
  var btn = document.getElementById('help-btn');
  if (clippy) { clippy.style.display = 'none'; }
  if (btn) btn.style.display = 'flex';
  hideClippySuggestion();
}

function showClippySuggestion(text) {
  var bubble = document.getElementById('clippy-suggestion');
  var txt = document.getElementById('clippy-suggestion-text');
  if (!bubble || !txt) return;
  txt.textContent = text || clippySuggestions[Math.floor(Math.random() * clippySuggestions.length)];
  bubble.style.display = 'block';
  // Auto hide after 8 seconds
  clearTimeout(clippySuggestionTimer);
  clippySuggestionTimer = setTimeout(hideClippySuggestion, 8000);
}

function hideClippySuggestion() {
  var bubble = document.getElementById('clippy-suggestion');
  if (bubble) bubble.style.display = 'none';
  clearTimeout(clippySuggestionTimer);
}

function scheduleClippySuggestion() {
  clearTimeout(clippySuggestionTimer);
  // Show a suggestion after 30s of inactivity (only if clippy is visible and chat isn't open)
  clippySuggestionTimer = setTimeout(function() {
    if (clippyState === 'full' && !chatOpen) {
      showClippySuggestion();
    }
  }, 30000);
}

// Initialize clippy on page load
(function() {
  // Start suggestion timer after page load
  setTimeout(scheduleClippySuggestion, 5000);
  // Allow right-click / long-press to dismiss clippy to tab
  var clippy = document.getElementById('luna-clippy');
  if (clippy) {
    clippy.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      clippyTab();
    });
  }
  // ── Draggable Clippy ──────────────────────────────────────────
    (function makeDraggable() {
      var el = document.getElementById('luna-clippy');
      if (!el) return;
      var startX, startY, origX, origY, dragging = false, dragDist = 0;
      function onStart(e) {
        if (e.button !== 0) return; // left-click only
        dragging = true;
        dragDist = 0;
        var pos = getComputedStyle(el);
        origX = parseInt(pos.left) || 0;
        origY = parseInt(pos.top) || 0;
        var pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        el.style.cursor = 'grabbing';
        el.style.transition = 'none';
        el.style.animation = 'none';
        document.body.style.userSelect = 'none';
      }
      function onMove(e) {
        if (!dragging) return;
        e.preventDefault();
        var pt = e.touches ? e.touches[0] : e;
        var dx = pt.clientX - startX;
        var dy = pt.clientY - startY;
        dragDist = Math.max(dragDist, Math.abs(dx), Math.abs(dy));
        el.style.left = (origX + dx) + 'px';
        el.style.top = (origY + dy) + 'px';
        if (!el.classList.contains('dragged')) {
          el.classList.add('dragged');
          var rect = el.getBoundingClientRect();
          el.style.left = rect.left + 'px';
          el.style.top = rect.top + 'px';
          el.style.bottom = 'auto';
          el.style.right = 'auto';
        }
      }
      function onEnd() {
        if (!dragging) return;
        dragging = false;
        el.style.cursor = 'grab';
        el.style.transition = '';
        el.style.animation = '';
        document.body.style.userSelect = '';
      }
      el.addEventListener('mousedown', onStart);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      el.addEventListener('touchstart', function(e) { onStart(e); }, {passive:true});
      document.addEventListener('touchmove', onMove, {passive:false});
      document.addEventListener('touchend', onEnd);
      el.style.cursor = 'grab';
      // Expose dragDist so clippyClick can check it
      window.__clippyDragDist = function() { return dragDist; };
    })();
})();

// ── CHAT ───────────────────────────────────────────────────────────
function toggleChat() {
  chatOpen = !chatOpen;
  var d = document.getElementById('chat-drawer');
  if (d) d.classList.toggle('open', chatOpen);
  // Hide/show clippy
  var clippy = document.getElementById('luna-clippy');
    if (clippy) clippy.classList.toggle('chat-open', chatOpen);
  if (chatOpen) {
      if (chatHistory.length === 0) {
        var introText = "Hi " + (luUser && luUser.name ? luUser.name.split(' ')[0] : 'there') + ". I'm LUCI, your Project Intelligence engine. Ask me anything about the playbook or MFP. Day 1 mobilization, change orders, punch list disputes, cost recovery audit, anything.";
        appendMsg('ai', introText);
        chatHistory.push({ role: 'assistant', content: introText });
      }
    setTimeout(function() {
      var ci = document.getElementById('chat-input');
      if (ci) ci.focus();
    }, 100);
  }
}

var chatExpanded = false;
function toggleChatSize() {
  chatExpanded = !chatExpanded;
  var d = document.getElementById('chat-drawer');
  if (!d) return;
  if (chatExpanded) {
    d.style.width = '90vw';
    d.style.maxHeight = '90vh';
    d.style.right = '5vw';
    d.style.bottom = '5vh';
  } else {
    d.style.width = '400px';
    d.style.maxHeight = '65vh';
    d.style.right = '24px';
    d.style.bottom = '88px';
  }
}

// Chat drag support
(function() {
  var header = document.getElementById('chat-header-drag');
  var drawer = document.getElementById('chat-drawer');
  if (!header || !drawer) return;
  var offsetX, offsetY, mouseX, mouseY;
  header.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'BUTTON') return;
    offsetX = e.clientX - drawer.getBoundingClientRect().left;
    offsetY = e.clientY - drawer.getBoundingClientRect().top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  function onMouseMove(e) {
    drawer.style.left = (e.clientX - offsetX) + 'px';
    drawer.style.top = (e.clientY - offsetY) + 'px';
    drawer.style.right = 'auto';
    drawer.style.bottom = 'auto';
  }
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
})();

function appendMsg(role, text) {
  var msgs = document.getElementById('chat-messages');
  if (!msgs) return null;
  var div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = String(text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function appendLoading() {
  var msgs = document.getElementById('chat-messages');
  if (!msgs) return { remove: function() {} };
  var div = document.createElement('div');
  div.className = 'chat-msg ai loading';
  div.textContent = '• • •';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function quickChat(text) {
  var inp = document.getElementById('chat-input');
  if (inp) inp.value = text;
  sendChat();
}

function sendChat() {
  var inp = document.getElementById('chat-input');
  var btn = document.getElementById('chat-send');
  if (!inp) return;
  var q = inp.value.trim();
  if (!q) return;
  inp.value = '';
  if (btn) btn.disabled = true;
  appendMsg('user', q);
  chatHistory.push({ role: 'user', content: q });
  var loader = appendLoading();

  // Build compact KB index for system prompt
    var kbIndex = KB.map(function(s) {
      return 'S' + s.num + ': ' + (s.title || '').replace('SECTION ' + s.num + ': ','') + ' [' + (s.phases||[]).join('/') + ']';
    }).join('\\n');

    // Build financial summary from loaded data
    var finSummary = '';
    var fin = window.__MFP_FINANCIALS;
    if (fin && fin.hard) {
      var h = fin.hard;
      finSummary = '\\n\\n=== FINANCIAL DETAILS ===\\n'
        + 'Hard Costs: $' + fmtNum(h.total_original) + ' original, $' + fmtNum(h.total_revised) + ' revised, $' + fmtNum(h.total_invoiced) + ' invoiced, $' + fmtNum(h.total_paid) + ' paid (' + h.total_pct_paid + '%), $' + fmtNum(h.total_balance) + ' balance\\n'
        + 'Approved COs: $' + fmtNum(h.total_approved_cos) + ' | Pending COs: $' + fmtNum(h.total_pending_cos) + '\\n';
      // Top 5 subs by balance
      if (h.commitments && h.commitments.length) {
        var sorted = h.commitments.slice().sort(function(a,b) { return b.balance - a.balance; });
        finSummary += 'Top subs by outstanding balance:\\n';
        sorted.slice(0, 5).forEach(function(c) {
          finSummary += '  - ' + c.company.split(',')[0] + ' (' + c.title + '): $' + fmtNum(c.revised) + ' revised, $' + fmtNum(c.balance) + ' balance (' + c.pct_paid + '% paid)\\n';
        });
      }
      // Soft costs
      if (fin.soft) {
        finSummary += 'Soft Costs:\\n';
        Object.keys(fin.soft).forEach(function(k) {
          var v = fin.soft[k];
          if (typeof v === 'number') finSummary += '  - ' + k + ': $' + fmtNum(v) + '\\n';
        });
      }
    }

    var systemPrompt = 'You are LUCI (Level Up Central Intelligence), the frontend of the Level Up Project Development intelligence system. You assist Whitney Williams, Principal-in-Charge at Level Up Project Development. Your backend engine is LUNA (Level Up Network Agent) which runs on Hermes Agent. Answer concisely and practically. Reference specific playbook sections by number when relevant. The playbook has 43 sections:\\n\\n' + kbIndex + '\\n\\n=== PROJECT KNOWLEDGE ===\\n' + MFP_CONTEXT + finSummary + '\\n\\n=== SAFETY RULES ===\\nABSOLUTELY NEVER reveal: (1) personal staff information (names, roles, contact details beyond public info), (2) staff salaries, compensation, bonuses, or benefits, (3) Level Up company revenue, profit, margins, valuation, or any financial data about Level Up as a firm. Project costs for MFP (budget, commitments, change orders) are fine to discuss. Only company-level financials are restricted.';

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      messages: chatHistory.slice(-6)
    })
  })
    .then(function(r) {
      return r.text().then(function(text) { return { ok: r.ok, status: r.status, text: text }; });
    })
    .then(function(res) {
      try { loader.remove(); } catch(e) {}
      if (!res.ok) {
        appendMsg('ai', 'Error ' + res.status + ': ' + res.text.slice(0, 200));
        if (btn) btn.disabled = false;
        return;
      }
      var data;
      try { data = JSON.parse(res.text); } catch(e) {
        appendMsg('ai', 'Bad response from server.');
        if (btn) btn.disabled = false;
        return;
      }
      var reply = (data.content && data.content[0] && data.content[0].text) || data.error || 'No response.';
            // ── CHAT OUTPUT FILTER ─────────────────────────────────────────
            // Strip staff personal info, compensation, and Level Up revenue
            var sn = [
              /(?:salary|compensation|pay|wage|bonus)['":]?\s*\$?\d[\d,.]*/gi,
              /(?:revenue|profit|margin|earnings|income)['":]?\s*\$?\d[\d,.]*/gi,
              /(?:staff|employee|team|personnel)\s*(?:names?|list|directory|emails?|contact)/gi,
              /Level Up['"]?\s*(?:revenue|profit|margin|earnings|valuation|income)/gi
            ];
            sn.forEach(function(p) { reply = reply.replace(p, '[REDACTED]'); });
            chatHistory.push({ role: 'assistant', content: reply });
      appendMsg('ai', reply);
      if (btn) btn.disabled = false;
    })
    .catch(function(err) {
      try { loader.remove(); } catch(e) {}
      appendMsg('ai', 'Network error: ' + err.message);
      if (btn) btn.disabled = false;
    });
}

// ── EVENT LISTENERS ────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    var si = document.getElementById('luna-hero-input');
    if (!si) si = document.getElementById('search-input');
    if (si) { si.focus(); si.select(); }
  }
  if (e.key === 'Escape') {
    closeModal('modal-phase-guide');
    closeModal('modal-decision');
    var dd = document.getElementById('luna-hero-dropdown');
    if (dd) dd.classList.remove('show');
  }
});

document.addEventListener('DOMContentLoaded', function() {
  var ci = document.getElementById('chat-input');
  if (ci) {
    ci.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }
});

// ── REMINDER SIDE PANEL ────────────────────────────────────────────
var reminderPanelOpen = false;
var reminderLastFetch = 0;

function isWhitney() {
  return luUser && luUser.authenticated && (
    (luUser.email && luUser.email.toLowerCase().indexOf('wwilliams@levelup') >= 0) ||
    (luUser.email && luUser.email.toLowerCase().indexOf('whitney') >= 0) ||
    (luUser.name && luUser.name.toLowerCase().indexOf('whitney') >= 0)
  );
}

function showReminderToggle() {
  var t = document.getElementById('reminder-toggle');
  if (!t) return;
  t.style.display = 'flex';
}

function initDailyBriefing() {
  showReminderToggle();
  if (isWhitney()) {
    refreshReminderData();
    // Auto-open on first load of the day
    var lastOpen = 0;
    try { lastOpen = parseInt(localStorage.getItem('lu_reminder_panel_last') || '0'); } catch(e) {}
    if (!lastOpen || new Date(lastOpen).toDateString() !== new Date().toDateString()) {
      setTimeout(openReminderPanel, 800);
      try { localStorage.setItem('lu_reminder_panel_last', Date.now()); } catch(e) {}
    }
  }
}

function openReminderPanel() {
  var panel = document.getElementById('reminder-panel');
  var toggle = document.getElementById('reminder-toggle');
  if (panel) {
    panel.style.display = 'flex';
    setTimeout(function() { panel.classList.remove('closed'); }, 10);
  }
  if (toggle) toggle.style.display = 'none';
  reminderPanelOpen = true;
  renderReminderPanel();
  startPanelAutoRefresh();
}

function closeReminderPanel() {
  var panel = document.getElementById('reminder-panel');
  var toggle = document.getElementById('reminder-toggle');
  if (panel) {
    panel.classList.add('closed');
    setTimeout(function() {
      panel.style.display = 'none';
      if (toggle) toggle.style.display = 'flex';
    }, 300);
  }
    reminderPanelOpen = false;
    stopPanelAutoRefresh();
}

function switchReminderTab(tab) {
  document.querySelectorAll('.reminder-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-rtab') === tab);
  });
  var a = document.getElementById('reminder-panel-actions');
  var m = document.getElementById('reminder-panel-meetings');
  var r = document.getElementById('reminder-panel-reminders');
  if (a) a.style.display = tab === 'actions' ? 'block' : 'none';
  if (m) m.style.display = tab === 'meetings' ? 'block' : 'none';
  if (r) r.style.display = tab === 'reminders' ? 'block' : 'none';
  if (tab === 'meetings') renderReminderMeetings();
  else if (tab === 'reminders') renderReminderReminders();
  else renderReminderActions();
}

function renderReminderPanel() {
  switchReminderTab('actions');
  renderReminderActions();
  setTimeout(renderReminderMeetings, 200);
}

// ── PANEL: ACTION ITEMS FROM STORE ────────────────────────────────
function renderReminderActions() {
  var el = document.getElementById('reminder-panel-actions');
  if (!el) return;
  var footer = document.getElementById('reminder-panel-footer-text');
  if (footer) footer.textContent = 'Loading from Smartsheet...';

  // Direct fetch — never falls back to localStorage
  fetch('/api/tasks')
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      var rows = data.tasks || [];
      // Filter: DOVA only, not Complete, overdue or due today
      var relevant = rows.filter(function(r) {
        return (r.project || '').toLowerCase() === 'dova'
            && r.status !== 'Complete'
            && (isOverdue(r) || isDueToday(r));
      });

      // FALL THROUGH to existing render logic (filtered list only)
      var flaggedEmails = [];
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/outlook/flagged', false);
        xhr.withCredentials = true;
        xhr.send();
        if (xhr.status === 200) {
          var fd = JSON.parse(xhr.responseText);
          flaggedEmails = fd.actions || [];
        }
      } catch(e) {}

      var mfpKeywords = ['mfp','freedom park','stadium','lemartec','punch','change order','cost recovery','arq','miller','baker','hvac','scoreboard','commissioning','closeout','pco','invoice','draw','pay app','retainage','tco','permitting','boldyn','das','seating','concession'];
      var mfpItems = [], levelUpItems = [];

      function classify(text, item) {
        var txt = (text || '').toLowerCase();
        var isMFP = mfpKeywords.some(function(kw) { return txt.indexOf(kw) >= 0; });
        (isMFP ? mfpItems : levelUpItems).push(item);
      }

      relevant.forEach(function(r) {
        classify(r.actionItem || r.title || '', {
          text: r.actionItem || r.title || '',
          rowId: r.rowId,
          source: r.source || 'project',
          priority: r.priority || (isOverdue(r) ? 'urgent' : 'medium'),
          status: r.status === 'In Progress' ? 'in_progress' : 'open',
          done: false,
          dueDate: r.dueDate,
          owner: r.owner,
          ts: Date.now(),
        });
      });

      flaggedEmails.forEach(function(email) {
        var accountTag = email.account ? ' [' + email.account.split('@')[0] + ']' : '';
        var displayText = email.text || email.subject;
        classify(email.subject + ' ' + (email.preview || ''), {
          text: '\uD83D\uDCE7 ' + displayText + accountTag,
          priority: email.priority || 'medium',
          ts: new Date(email.receivedDate || email.flaggedDate).getTime(),
          author: email.from || '',
          source: 'flagged',
          preview: email.preview || '',
          rowId: null,
          status: 'open',
          done: false,
        });
      });

      function sortGroup(arr) {
        arr.sort(function(a,b) {
          var rank = { urgent:0, high:1, medium:2, low:3 };
          var ar = rank[a.priority]||2, br = rank[b.priority]||2;
          if (ar !== br) return ar - br;
          return (b.ts || 0) - (a.ts || 0);
        });
      }
      sortGroup(mfpItems);
      sortGroup(levelUpItems);

      var html = '';
      var toggleIcon = document.getElementById('reminder-toggle-count');
      var totalOpen = mfpItems.length + levelUpItems.length;

      html += '<div style="font-size:11px;color:var(--muted);padding:6px 2px 8px;border-bottom:1px solid var(--border);margin-bottom:6px;display:flex;align-items:center;gap:6px">'
        + '<span style="font-size:16px">\uD83D\uDCCB</span>'
        + '<span style="flex:1">DOVA actions due/overdue. <strong>Click</strong> to cycle: Open \u2192 In Progress \u2192 Complete</span>'
        + '<button onclick="refreshPanelActions()" style="background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:11px;padding:3px 8px;color:var(--muted);font-family:inherit" title="Refresh from server">\u21BB Refresh</button>'
        + '</div>';

      if (mfpItems.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px">\uD83D\uDD34 MFP / Team (' + mfpItems.length + ')</div>';
        mfpItems.slice(0, 25).forEach(function(item) {
          var st = item.done ? 'completed' : item.status === 'in_progress' ? 'in_progress' : 'open';
          var statusIcon = st === 'completed' ? '\u2713' : st === 'in_progress' ? '\u25D0' : '\u25CB';
          var priColor = item.priority === 'urgent' ? '#c0392b' : item.priority === 'high' ? '#e67e22' : '#95a5a6';
          var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
          html += '<div class="rp-item status-' + st + '">'
            + '<button class="rp-status-btn ' + st + '" onclick="panelToggleAction(\'' + (item.source || 'project') + '\',' + (item.rowId || item.ts) + ')" title="Click to cycle status">' + statusIcon + '</button>'
            + '<div class="rp-item-text" style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:2px">'
            + '<span style="background:' + priColor + ';color:#fff;font-size:9px;font-weight:700;padding:0 6px;border-radius:8px;text-transform:uppercase">' + (item.priority || 'medium') + '</span>'
            + '<span style="font-size:9px;color:' + (st === 'in_progress' ? '#e67e22' : st === 'completed' ? '#27ae60' : 'var(--muted)') + ';font-weight:600">' + st.replace('_',' ') + '</span>'
            + (item.dueDate ? '<span style="font-size:10px;color:' + (new Date(item.dueDate+'T12:00:00') < new Date() ? '#c0392b' : 'var(--muted)') + '">' + item.dueDate + '</span>' : '')
            + '</div>'
            + '<div style="font-size:13px;color:var(--charcoal);line-height:1.4">' + (st === 'completed' ? '<s style="opacity:.6">' : '') + escapeHtml(item.text) + (st === 'completed' ? '</s>' : '') + '</div>'
            + (item.preview && item.source === 'flagged' ? '<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(item.preview.substring(0, 120)) + '</div>' : '')
            + '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + date + (item.author ? ' by ' + escapeHtml(item.author) : '') + '</div>'
            + '</div>'
            + '</div>';
        });
      }

      if (levelUpItems.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:#4a90d9;text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px;margin-top:4px">\uD83D\uDCCB Level Up / Personal (' + levelUpItems.length + ')</div>';
        levelUpItems.slice(0, 15).forEach(function(item) {
          var st = item.done ? 'completed' : item.status === 'in_progress' ? 'in_progress' : 'open';
          var statusIcon = st === 'completed' ? '\u2713' : st === 'in_progress' ? '\u25D0' : '\u25CB';
          var priColor = item.priority === 'urgent' ? '#c0392b' : item.priority === 'high' ? '#e67e22' : '#95a5a6';
          var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
          html += '<div class="rp-item status-' + st + '">'
            + '<button class="rp-status-btn ' + st + '" onclick="panelToggleAction(\'' + (item.source || 'project') + '\',' + (item.rowId || item.ts) + ')" title="Click to cycle status">' + statusIcon + '</button>'
            + '<div class="rp-item-text" style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:2px">'
            + '<span style="background:' + priColor + ';color:#fff;font-size:9px;font-weight:700;padding:0 6px;border-radius:8px;text-transform:uppercase">' + (item.priority || 'medium') + '</span>'
            + '<span style="font-size:9px;color:' + (st === 'in_progress' ? '#e67e22' : st === 'completed' ? '#27ae60' : 'var(--muted)') + ';font-weight:600">' + st.replace('_',' ') + '</span>'
            + (item.dueDate ? '<span style="font-size:10px;color:' + (new Date(item.dueDate+'T12:00:00') < new Date() ? '#c0392b' : 'var(--muted)') + '">' + item.dueDate + '</span>' : '')
            + '</div>'
            + '<div style="font-size:13px;color:var(--charcoal);line-height:1.4">' + (st === 'completed' ? '<s style="opacity:.6">' : '') + escapeHtml(item.text) + (st === 'completed' ? '</s>' : '') + '</div>'
            + '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + date + (item.author ? ' by ' + escapeHtml(item.author) : '') + '</div>'
            + '</div>'
            + '</div>';
        });
      }

      if (!html) {
        html = '<div class="rp-empty"><div class="rp-empty-icon">\u2705</div>All caught up! No overdue or due-today DOVA actions.</div>';
      }

      if (toggleIcon) toggleIcon.textContent = totalOpen > 9 ? '9+' : totalOpen;
      el.innerHTML = html;
      if (footer) footer.textContent = totalOpen + ' overdue/due from Smartsheet \u00B7 ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    })
    .catch(function(e) {
      el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted)"><div style="font-size:32px;margin-bottom:12px">\u26A0\uFE0F</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">Could not reach Smartsheet</div><div style="font-size:11px;color:var(--muted)">' + escapeHtml(e.message) + '</div></div>';
      if (footer) footer.textContent = 'Could not reach Smartsheet';
    });
}

  // Refresh panel actions from server
  function refreshPanelActions() {
    var el = document.getElementById('reminder-panel-actions');
    if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">\u23F3 Refreshing...</div>';
    // Clear flagged email cache by running the fetch again
    renderReminderActions();
  }

  // Auto-refresh panel every 30 seconds while open
  var panelRefreshTimer = null;
  function startPanelAutoRefresh() {
    stopPanelAutoRefresh();
    panelRefreshTimer = setInterval(function() {
      if (reminderPanelOpen) {
        renderReminderActions();
      }
    }, 30000);
  }
  function stopPanelAutoRefresh() {
    if (panelRefreshTimer) {
      clearInterval(panelRefreshTimer);
      panelRefreshTimer = null;
    }
  }

  // Panel click handler
  function panelToggleAction(source, rowId) {
    // If it's a flagged email (no rowId), skip the write — read-only
    if (source === 'flagged' || !rowId) {
      renderReminderActions();
      return;
    }
    // Find the row in STORE
    var row = STORE.rows.find(function(r) { return String(r.rowId) === String(rowId); });
    if (!row) { renderReminderActions(); return; }
    // Cycle: open → in_progress → completed → open
    var next = row.status === 'In Progress' ? 'Complete' : row.status === 'Complete' ? 'Not Started' : 'In Progress';
    // Write back via /api/tasks POST
    fetch('/api/tasks/' + rowId + '?source=' + (row.source || 'project'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next })
    }).then(function() {
      renderReminderActions();
    }).catch(function() {
      renderReminderActions();
    });
  }

function renderReminderMeetings() {
  var el = document.getElementById('reminder-panel-meetings');
  if (!el) return;
  if (!luUser || !luUser.authenticated) {
    el.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">\uD83D\uDD12</div>Sign in to see your calendar.</div>';
    return;
  }

  el.innerHTML = '<div class="reminder-loader">Loading meetings...</div>';

    var fetchUrl = '/api/outlook/calendar?days=7';
    // Also try the client's native calendar fetch via the browser
    fetch(fetchUrl, { credentials: 'include' })
      .then(function(r) {
        if (!r.ok) { return r.text().then(function(t) { throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200)); }); }
        return r.json();
      })
    .then(function(data) {
      var events = data.value || [];
      var now = new Date();
      var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      var todayEvents = events.filter(function(e) {
        var start = new Date(e.start.dateTime || e.start.date);
        return start >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && start <= endOfDay;
      });
      // --- TODAY'S MEETINGS ---
      todayEvents.sort(function(a,b) {
        return new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date);
      });

      var html = '';
      // Separate MFP vs Level Up meetings  
      var mfpKeywords = ['miami','freedom','park','mfp','stadium','lemartec','closeout','punch','cost recovery','arq','commissioning','owner meeting'];
      var mfpToday = [];
      var levelUpToday = [];
      todayEvents.forEach(function(e) {
        var txt = ((e.subject||'') + ' ' + (e._calendarName||'')).toLowerCase();
        var isMFP = mfpKeywords.some(function(kw) { return txt.indexOf(kw) >= 0; });
        (isMFP ? mfpToday : levelUpToday).push(e);
      });

      // Today's MFP meetings
      if (mfpToday.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px;display:flex;align-items:center;gap:6px"><span>\uD83C\uDFDF</span> MFP Today <span style="background:#c0392b;color:#fff;font-size:9px;padding:1px 7px;border-radius:8px">' + mfpToday.length + '</span></div>';
        mfpToday.forEach(function(e) {
          var start = new Date(e.start.dateTime || e.start.date);
          var end = new Date(e.end.dateTime || e.end.date);
          var timeStr = start.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + '-' + end.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
          var isNow = now >= start && now <= end;
          var calName = e._calendarName;
          html += '<div class="rp-meeting" style="' + (isNow ? 'border-left-color:#e74c3c;background:#fce8e8' : '') + '"><span class="rp-meeting-time">' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>'
            + (calName ? '<div style="font-size:10px;color:#c0392b;font-weight:500;margin-top:1px">\uD83D\uDCC1 ' + escapeHtml(calName) + '</div>' : '')
            + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '')
            + (isNow ? '<div style="font-size:11px;color:#c0392b;font-weight:600;margin-top:2px">\u25CF In progress</div>' : '') + '</div></div>';
        });
      }

      // Today's Level Up meetings
      if (levelUpToday.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px;margin-top:' + (mfpToday.length > 0 ? '6px' : '0') + ';display:flex;align-items:center;gap:6px"><span>\uD83D\uDCC5</span> Level Up Today <span style="background:var(--teal);color:#fff;font-size:9px;padding:1px 7px;border-radius:8px">' + levelUpToday.length + '</span></div>';
        levelUpToday.forEach(function(e) {
          var start = new Date(e.start.dateTime || e.start.date);
          var end = new Date(e.end.dateTime || e.end.date);
          var timeStr = start.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + '-' + end.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
          var isNow = now >= start && now <= end;
          html += '<div class="rp-meeting" style="' + (isNow ? 'border-left-color:#e74c3c;background:#fce8e8' : '') + '"><span class="rp-meeting-time">' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>' + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '') + (isNow ? '<div style="font-size:11px;color:#c0392b;font-weight:600;margin-top:2px">\u25CF In progress</div>' : '') + '</div></div>';
        });
      }

      // --- UPCOMING THIS WEEK ---
      var upcomingThisWeek = events.filter(function(e) {
        var start = new Date(e.start.dateTime || e.start.date);
        var weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
        weekEnd.setHours(23, 59, 59, 0);
        // Skip today's events (already shown above)
        var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        return start > todayEnd && start <= weekEnd;
      }).slice(0, 10);

      if (upcomingThisWeek.length > 0) {
              if (html) html += '<div style="border-top:1px solid var(--border);margin:8px 0"></div>';
              html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:6px 0 6px">\uD83D\uDD14 Later This Week (' + upcomingThisWeek.length + ')</div>';
              upcomingThisWeek.forEach(function(e) {
                var start = new Date(e.start.dateTime || e.start.date);
                var timeStr = start.toLocaleTimeString([], { weekday:'short', hour:'2-digit', minute:'2-digit' });
                var calName = e._calendarName;
                html += '<div class="rp-meeting" style="background:var(--teal-light);border-left-color:var(--teal);border-left-width:3px"><span class="rp-meeting-time" style="color:var(--teal);font-weight:600">\uD83D\uDD14 ' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>'
                  + (calName ? '<div style="font-size:10px;color:var(--muted);font-weight:500;margin-top:1px">\uD83D\uDCC1 ' + escapeHtml(calName) + '</div>' : '')
                  + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '') + '</div></div>';
              });
            }

      // Empty state
      if (!html) {
        html = '<div class="rp-empty"><div class="rp-empty-icon">\uD83D\uDCC5</div>No meetings today or this week.</div>';
      }
      el.innerHTML = html;
    })
    .catch(function(err) {
          el.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">\u26A0\uFE0F</div>' + escapeHtml(err.message || 'Could not load calendar.') + '</div>';
        });
        }

        // ── PANEL: REMINDERS TAB ──
        function renderReminderReminders() {
          var el = document.getElementById('reminder-panel-reminders');
          if (!el) return;
          var now = new Date();
          var day = now.getDate();
          var month = now.getMonth();
          var year = now.getFullYear();
          var dismissed = {};
          try { var d = localStorage.getItem('lu_remind_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
          var reminders = [];
          var drawDue = new Date(year, month, 10);
          if (day > 10) drawDue.setMonth(month + 1);
          var drawDays = Math.round((drawDue - now) / 86400000);
          var drawId = 'draw_' + year + '-' + month;
          if (!dismissed[drawId]) reminders.push({ id: drawId, icon: '\uD83D\uDCB0', title: 'Monthly Draw Package', desc: 'Due in ' + drawDays + ' day' + (drawDays !== 1 ? 's' : ''), urgent: drawDays <= 3, warn: drawDays <= 7 && drawDays > 3 });
          var expDue = new Date(year, month, 5);
          if (day > 5) expDue.setMonth(month + 1);
          var expDays = Math.round((expDue - now) / 86400000);
          var expId = 'expense_' + year + '-' + month;
          if (!dismissed[expId]) reminders.push({ id: expId, icon: '\uD83E\uDDFE', title: 'Monthly Expense Report', desc: 'Due in ' + expDays + ' day' + (expDays !== 1 ? 's' : ''), urgent: expDays <= 3, warn: expDays <= 7 && expDays > 3 });
          var friday = new Date(now);
          friday.setDate(now.getDate() + (5 - now.getDay() + 7) % 7);
          if (now.getDay() > 5) friday.setDate(friday.getDate() + 7);
          if (now.getDay() === 5 && now.getHours() >= 17) friday.setDate(friday.getDate() + 7);
          var calDays = Math.round((friday - now) / 86400000);
          var calId = 'cal_' + friday.getFullYear() + '_' + friday.getMonth() + '_' + friday.getDate();
          if (!dismissed[calId]) reminders.push({ id: calId, icon: '\uD83D\uDCC5', title: 'Weekly Events Calendar', desc: calDays === 0 ? 'Due today' : 'Due in ' + calDays + ' day' + (calDays !== 1 ? 's' : ''), urgent: calDays <= 1, warn: calDays <= 2 && calDays > 1 });
          var html = '';
          reminders.forEach(function(r) {
            var bg = r.urgent ? '#fce8e8' : r.warn ? '#fef4e0' : 'var(--card)';
            var border = r.urgent ? '#e74c3c' : r.warn ? '#e67e22' : 'var(--border)';
            var txtColor = r.urgent ? '#c0392b' : r.warn ? '#a05c00' : 'var(--muted)';
            html += '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:8px;margin-bottom:6px">'
              + '<span style="font-size:18px">' + r.icon + '</span>'
              + '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--charcoal)">' + escapeHtml(r.title) + '</div>'
              + '<div style="font-size:12px;color:' + txtColor + '">' + escapeHtml(r.desc) + '</div></div>'
              + (r.urgent ? '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#e74c3c;background:rgba(231,76,60,.12);padding:3px 8px;border-radius:6px">Due Soon</span>' : '')
              + (r.warn ? '<span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#e67e22">Coming Up</span>' : '')
              + '<button onclick="dismissReminder(' + jsCallArg(r.id) + ')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:4px" title="Dismiss">&times;</button>'
              + '</div>';
          });
          if (!html) html = '<div class="rp-empty"><div class="rp-empty-icon">\u2705</div>No reminders.</div>';
          el.innerHTML = html;
          var footer = document.getElementById('reminder-panel-footer-text');
          if (footer) footer.textContent = reminders.length + ' reminder' + (reminders.length !== 1 ? 's' : '') + ' \u00B7 Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        }

        // ── EMAIL SCANNER — saves directly into Action Items system ───────
        function refreshReminderData() {
  if (!luUser || !luUser.authenticated) return;
  if (Date.now() - reminderLastFetch < 15 * 60 * 1000) return;
  reminderLastFetch = Date.now();
  scanMFPEmails();
}

function scanMFPEmails() {
  if (!isWhitney()) return;
  fetch('/api/outlook/action-items?limit=150&days=21', { credentials: 'include' })
    .then(function(r) {
      if (!r.ok) throw new Error('Failed (' + r.status + ')');
      return r.json();
    })
    .then(function(data) {
      var emails = data.value || [];
      if (!emails.length) return;
      extractActionItemsFromEmails(emails);
    })
    .catch(function(err) {
      console.log('MFP email scan:', err.message);
    });
}

function extractActionItemsFromEmails(emails) {
  var targets = ['whitney williams', 'justin williams', 'jordan ward', 'wwilliams', 'justin.williams', 'jordan.ward'];
  var targetShort = ['whitney', 'justin', 'jordan'];
  var mfpKW = [
    'mfp','freedom park','stadium','lemartec','punch','change order','cost recovery',
    'arq','miller','baker','hvac','scoreboard','commissioning','closeout','pco','invoice',
    'draw','pay app','retainage','tco','permitting','boldyn','das','seating','concession',
    'ff&e','punch list','deficiency','scope','contract','submittal','rfp','rfi',
    'schedule','delay','accelerat','owner','graham','devon','victor'
  ];

  // Action signal phrases — stronger signals mean higher likelihood this is a real action
  var actionSignals = [
    { words: ['please', 'can you', 'could you', 'need you to', 'action required', 'action item'], weight: 2 },
    { words: ['by end of', 'due by', 'deadline', 'asap', 'urgent', 'eod', 'eow'], weight: 2 },
    { words: ['review', 'approve', 'submit', 'provide', 'send', 'confirm', 'update', 'complete', 'finish'], weight: 1.5 },
    { words: ['assigned', 'ownership', 'task', 'to-do', 'todo', 'follow up', 'follow-up'], weight: 2 },
    { words: ['question', 'request', 'proposal', 'for review', 'needs your'], weight: 1 },
    { words: ['invoice', 'payment', 'pco', 'change order', 'draw', 'pay app'], weight: 1.5 },
    { words: ['meeting', 'call', 'agenda', 'schedule', 'calendar'], weight: 0.5 }
  ];

  function getDirectAssignment(combined, subject, from) {
    // Check if email body directly assigns to a target
    var assignments = [];
    targetShort.forEach(function(t, i) {
      var full = targets[i];
      // Direct assignment patterns: "Whitney - please", "Whitney: can you", "Justin, please", etc.
      var assignPatterns = [
        t + '\\s*[-:]\\s*please', t + '\\s*[-:]\\s*can you', t + '\\s*[-:]\\s*need',
        t + '\\s*[-:]\\s*review', t + '\\s*[-:]\\s*submit', t + '\\s*[-:]\\s*provide',
        'action.*' + t, t + '.*assigned', 'assigned to ' + t,
        t + '.*task', t + '.*to-do', t + '.*follow up'
      ];
      var matched = assignPatterns.some(function(p) {
        return new RegExp(p, 'i').test(combined);
      });
      if (matched) assignments.push(full);
    });
    // Also check if sent TO a specific person
    if (from && from.toLowerCase().indexOf('wwilliams@levelup') >= 0) {
      assignments.push('Whitney Williams');
    }
    return assignments;
  }

  function calculateActionScore(combined) {
    var score = 1.0; // baseline
    actionSignals.forEach(function(signal) {
      var matchCount = 0;
      signal.words.forEach(function(w) {
        if (combined.indexOf(w) >= 0) matchCount++;
      });
      if (matchCount > 0) score += signal.weight * matchCount;
    });
    return score;
  }

  var mfpItems = [];
  var luItems = [];
  var seenMFP = {};
  var seenLU = {};

  emails.forEach(function(email) {
    var subject = (email.subject || '').toLowerCase();
    var preview = (email.bodyPreview || '').toLowerCase();
    var from = (email.from && email.from.emailAddress) ? (email.from.emailAddress.name || email.from.emailAddress.address) : '';
    var combined = subject + ' ' + preview;

    // Check MFP relevance
    var isMFP = mfpKW.some(function(kw) { return combined.indexOf(kw) >= 0; });

    // Check if sent TO Whitney directly (primary recipient)
    var isDirectToMe = (email.toRecipients || []).some(function(r) {
      var addr = (r.emailAddress && r.emailAddress.address || '').toLowerCase();
      return addr.indexOf('wwilliams@levelup') >= 0 || addr.indexOf('whitney.williams') >= 0 || addr.indexOf('whitney@') >= 0;
    });

    // Check if Whitney is in TO or CC
    var isToOrCC = isDirectToMe || (email.ccRecipients || []).some(function(r) {
      var addr = (r.emailAddress && r.emailAddress.address || '').toLowerCase();
      return addr.indexOf('wwilliams@levelup') >= 0;
    });

    // Check if mentions target team members
    var mentionsTarget = targets.some(function(t) { return combined.indexOf(t) >= 0; });

    // Calculate action score
    var actionScore = calculateActionScore(combined);

    // Get direct assignments
    var assignments = getDirectAssignment(combined, subject, from);

    // DECISION: Is this a real action for the team?
    // Must have BOTH: (direct to me OR mentions target) AND (action score >= threshold)
    var isRealAction = false;
    var why = '';

    if (isDirectToMe && actionScore >= 2.0) {
      isRealAction = true;
      why = 'direct to me';
    } else if (assignments.length > 0) {
      isRealAction = true;
      why = 'assigned to: ' + assignments.join(', ');
    } else if (mentionsTarget && actionScore >= 2.5) {
      isRealAction = true;
      why = 'mentions team + action signals';
    } else if (isToOrCC && actionScore >= 3.0) {
      isRealAction = true;
      why = 'cc\'d with strong action signals';
    } else if (mentionsTarget && actionScore >= 1.5 && combined.indexOf('action') >= 0) {
      isRealAction = true;
      why = 'explicit action keyword';
    }

    if (!isRealAction) return;

    // Build a concise action text — prefer subject, but if subject is just "Re: X" use body snippet
    var actionText = email.subject || '';
    // If subject is too generic like "Re: meeting" or "Fwd: info", look for the action in the preview
    if (!actionText || actionText.length < 10 || /^(re:|fwd:)\s*(meeting|update|info|question|fyi|note)/i.test(actionText)) {
      // Try to extract action sentence from preview
      var sentences = preview.split(/[.!?]\s*/);
      var actionSentence = '';
      sentences.forEach(function(s) {
        var testS = s.toLowerCase();
        if (actionSignals.some(function(sig) { return sig.words.some(function(w) { return testS.indexOf(w) >= 0; }); })) {
          if (testS.length > 15 && testS.length < 200) {
            actionSentence = s;
          }
        }
      });
      if (actionSentence) {
        actionText = actionSentence.charAt(0).toUpperCase() + actionSentence.slice(1);
      } else {
        actionText = preview.slice(0, 140);
      }
    } else {
      actionText = actionText.replace(/^(re:|fwd:)\s*/i, '').trim();
    }

    if (actionText.length > 150) actionText = actionText.slice(0, 150) + '...';
    if (!actionText || actionText.length < 10) return;

    // Dedup by text
    var key = actionText.toLowerCase().slice(0, 50);
    var dedupMap = isMFP ? seenMFP : seenLU;
    if (dedupMap[key]) return;
    dedupMap[key] = true;

    // Priority based on signal strength
    var priority = 'medium';
    if (actionScore >= 4.0) priority = 'urgent';
    else if (actionScore >= 2.5) priority = 'high';

    // Determine who it's assigned to (prefer direct assignment detection)
    var assignedTo = assignments.length > 0 ? assignments[0] : '';
    if (!assignedTo) {
      if (combined.indexOf('jordan') >= 0) assignedTo = 'Jordan Ward';
      else if (combined.indexOf('justin') >= 0) assignedTo = 'Justin Williams';
      else if (combined.indexOf('whitney') >= 0) assignedTo = 'Whitney Williams';
    }

    var date = new Date(email.receivedDateTime);
    var actionItem = {
      id: 'email_' + email.receivedDateTime + '_' + Math.random().toString(36).slice(2,6),
      text: actionText + (assignments.length > 0 ? ' [' + assignments.join(', ') + ']' : ''),
      done: false,
      status: 'open',
      ts: date.getTime(),
      author: from || 'LUCI',
      priority: priority,
      category: isMFP ? 'meeting' : 'other',
      dueDate: null,
      assignedTo: assignedTo
    };

    if (isMFP) {
      mfpItems.push(actionItem);
    } else {
      luItems.push(actionItem);
    }
  });

  // Save MFP items to Team, non-MFP to Personal
  mergeEmailItems('team', mfpItems);
  mergeEmailItems('personal', luItems);

  if (reminderPanelOpen) renderReminderActions();
}

function mergeEmailItems(tab, newItems) {
  if (!newItems.length) return;
  var existing = [];
  try { existing = JSON.parse(localStorage.getItem('lu_actions_' + tab) || '[]'); } catch(e) {}
  
  // Build dedup set from existing items
  var existingKeys = {};
  existing.forEach(function(item) {
    if (item.id) existingKeys[item.id] = true;
    // Also dedup by text
    if (item.text) existingKeys['txt_' + item.text.toLowerCase().slice(0, 40)] = true;
  });

  var added = 0;
  newItems.forEach(function(item) {
    if (existingKeys[item.id]) return;
    if (existingKeys['txt_' + (item.text || '').toLowerCase().slice(0, 40)]) return;
    existing.unshift(item);
    existingKeys[item.id] = true;
    added++;
  });

  if (added > 0) {
    try { localStorage.setItem('lu_actions_' + tab, JSON.stringify(existing)); } catch(e) {}
  }
}

// ── INIT ───────────────────────────────────────────────────────────
function init() {
  // Set initial footer status
  var footer = document.getElementById('footer-status-text');
  if (footer) footer.textContent = 'JS OK · Initializing...';

  // Theme
  try {
    var savedTheme = localStorage.getItem('lu_theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  } catch(e) {}

  // Auth
      checkAuthFromCookie();
      updateAuthUI();
      // Async fallback: if cookie check failed, try /auth/me (reads HttpOnly lu_auth)
      if (!luUser || !luUser.authenticated) {
        tryRefresh();
      }
      // Initialize KB now that data scripts have loaded
      initKB();
      // Initialize daily briefing/side panel
      initDailyBriefing();

  // Update footer status
  if (footer) {
    var status = luUser && luUser.authenticated ? 'Signed in: ' + luUser.email : 'Not signed in';
    footer.textContent = 'JS OK · ' + status + ' · KB=' + KB.length;
  }

  // Render home page — currently no fixed stats bar
        // Update data sync timestamp
      var freqEl = document.querySelector('.luna-status-freq');
      if (freqEl) {
        freqEl.textContent = 'Data: static as of Jun 8';
      }
    var urlParams = new URLSearchParams(window.location.search);
    var authSuccess = urlParams.get('auth') === 'success';
    var returnView = 'luna';
    if (authSuccess) {
      history.replaceState({}, '', '/');
      try {
        returnView = localStorage.getItem('lu_return_view') || 'luna';
        localStorage.removeItem('lu_return_view');
      } catch(e) {}
    }

    setView(returnView);
    // Also check ?view= URL param for bookmarked links (e.g., /?view=tasks from /api/actions redirect)
    var viewParam = new URLSearchParams(window.location.search).get('view');
    if (viewParam && viewParam !== returnView) {
      setTimeout(function() { setView(viewParam); }, 50);
    }
    }

  // ── LUCI HERO (default home view) ────────────────────────────────
    function renderHero() {
          renderBriefing();
          var results = document.getElementById('luna-hero-results');
      if (results && Object.keys(heroResults).length > 0) {
        var html = '';
        for (var key in heroResults) {
          var entry = heroResults[key];
          html += '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(entry.q) + '</div>';
          html += '<div class="luna-result-a">' + escapeHtml(entry.a) + '</div>';
        }
        results.innerHTML = html;
      }
      setTimeout(function() {
        var inp = document.getElementById('luna-hero-input');
        if (inp) inp.focus();
      }, 200);
    }

    function heroSearch() {
      var inp = document.getElementById('luna-hero-input');
      if (!inp) return;
      var q = inp.value.trim();
      if (!q) return;
      inp.value = '';
      // Clear dropdown
      var dd = document.getElementById('luna-hero-dropdown');
      if (dd) { dd.classList.remove('show'); dd.innerHTML = ''; }
      // Also remove from server-side search result
      heroDoAsk(q);
    }

    function heroSearchType(val) {
      var dd = document.getElementById('luna-hero-dropdown');
      if (!dd) return;
      var q = val.trim();
      if (!q) { dd.classList.remove('show'); dd.innerHTML = ''; return; }
      var ql = q.toLowerCase();
      var results = [];

      // Search KB
                  KB.forEach(function(s) {
                    var hay = [s.title, s.num].concat(s.topics || []).concat(s.h2 || []).concat(s.content || []).concat(s.bullets || []).join(' ').toLowerCase();
                    if (hay.indexOf(ql) >= 0) {
                      var preview = '';
                      var contents = s.content || [];
                      var bullets = s.bullets || [];
                      for (var ci = 0; ci < contents.length; ci++) {
                        if (contents[ci].toLowerCase().indexOf(ql) >= 0) {
                          preview = contents[ci].substring(0, 160);
                          break;
                        }
                      }
                      if (!preview) {
                        for (var bi = 0; bi < bullets.length; bi++) {
                          if (bullets[bi].toLowerCase().indexOf(ql) >= 0) {
                            preview = bullets[bi].substring(0, 160);
                            break;
                          }
                        }
                      }
                      if (!preview && s.h2 && s.h2.length) preview = s.h2[0].substring(0, 120);
                      if (!preview) preview = (s.content || []).slice(0, 2).join(' ').substring(0, 120);
                      results.push({type:'playbook', label:'Section ' + s.num + ': ' + (s.title || ''), id:s.num, preview:preview});
                    }
                  });

            // Search contracts KB
            CONTRACT_KB.forEach(function(s) {
              var hay = [s.title, s.num].concat(s.topics || []).concat(s.h2 || []).concat(s.content || []).concat(s.bullets || []).join(' ').toLowerCase();
              if (hay.indexOf(ql) >= 0) {
                var preview = (s.content || []).slice(0, 2).join(' | ').substring(0, 160) || (s.bullets || []).slice(0, 1).join(' ').substring(0, 120) || s.title;
                results.push({type:'contract', label:'Contract: ' + (s.title || ''), id:s.num, preview:preview});
              }
            });

      // Search templates
      for (var key in TEMPLATES) {
        var t = TEMPLATES[key];
        if ((t.name && t.name.toLowerCase().indexOf(ql) >= 0) || (t.desc && t.desc.toLowerCase().indexOf(ql) >= 0)) {
          results.push({type:'template', label:'Template: ' + (t.name||key), id:key, preview:(t.desc||'').substring(0,120)});
        }
      }

      // Search project context
      var projectKW = ['mfp','freedom park','stadium','lemartec','arq','punch','budget','change order','closeout','miller'];
      if (projectKW.some(function(kw){return kw.indexOf(ql)>=0||ql.indexOf(kw)>=0;})) {
        results.push({type:'project', label:'Project: Miami Freedom Park Stadium', id:'mfp', preview:'Post-opening closeout. Active workstreams: punch list closeout, cost recovery audit, Lemartec contract closeout.'});
      }

      if (results.length === 0) { dd.classList.remove('show'); dd.innerHTML = ''; return; }

      // Highlight function
      function hl(text) {
        if (!text) return '';
        var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
        return text.replace(re, '<mark>$1</mark>');
      }

      var icons = {playbook:'\uD83D\uDCDA', template:'\uD83D\uDCD1', project:'\uD83C\uDFDF', contract:'\uD83D\uDCDD'};
            var html = '<div class="luna-hero-dropdown-inner">';
            html += '<div style="padding:6px 14px 8px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)">' + results.length + ' result' + (results.length>1?'s':'') + ' for &quot;' + escapeHtml(q) + '&quot;</div>';
      results.slice(0, 20).forEach(function(r) {
              var icon = icons[r.type]||'\uD83D\uDCC4';
              var onClick = "var dd=document.getElementById('luna-hero-dropdown');if(dd){dd.classList.remove('show');dd.innerHTML=''}document.getElementById('luna-hero-input').value='';";
              if (r.type === 'playbook') onClick += "setView('playbook');setPlaybookView('sections');jumpTo('" + r.id + "');";
              else if (r.type === 'template') onClick += "setView('playbook');setPlaybookView('templates');";
              else if (r.type === 'project') onClick += "setView('mfp');";
              html += '<div class="luna-hero-dd-item" onclick="' + onClick + '">'
                + '<span class="luna-hero-dd-icon">' + icon + '</span>'
                + '<div style="flex:1;min-width:0">'
                + '<div class="luna-hero-dd-text">' + hl(r.label) + '</div>'
                + (r.preview ? '<div class="luna-hero-dd-desc">' + hl(r.preview.substring(0, 160)) + '</div>' : '')
                + '</div><span class="luna-hero-dd-src">' + r.type + '</span></div>';
      });
      html += '</div>';
      dd.innerHTML = html;
      dd.classList.add('show');

      // Click outside to close
      var closeHandler = function(e) {
        if (!dd.contains(e.target) && e.target.id !== 'luna-hero-input') {
          dd.classList.remove('show');
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(function() { document.addEventListener('click', closeHandler); }, 10);
    }

    function heroQuick(q) {
      var inp = document.getElementById('luna-hero-input');
      if (inp) inp.value = q;
      heroSearch();
    }

    function heroDoAsk(q) {
      var btn = document.querySelector('.luna-hero-btn');
      var results = document.getElementById('luna-hero-results');
      if (!results) return;

      if (btn) btn.disabled = true;
      document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = true; });

      // Show loading
      results.innerHTML = '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(q) + '</div>'
        + '<div class="luna-result-a loading">Thinking...</div>';
      results.scrollIntoView({ behavior: 'smooth', block: 'end' });

      // Check cache (1-hour)
      var cacheKey = 'luna_' + q.toLowerCase().trim().replace(/[^a-z0-9]/g,'_').slice(0,80);
      try {
        var cached = JSON.parse(localStorage.getItem(cacheKey));
        if (cached && cached.ts > Date.now() - 3600000) {
          results.innerHTML = '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(q) + '</div>'
            + '<div class="luna-result-a">' + cached.answer + '</div>';
          heroResults[q] = { q: q, a: cached.answer };
          if (btn) btn.disabled = false;
          document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = false; });
          return;
        }
      } catch(e) {}

      var kbIndex = KB.map(function(s) {
        return 'S' + s.num + ': ' + (s.title||'').replace('SECTION ' + s.num + ': ','') + ' [' + (s.phases||[]).join('/') + ']';
      }).join('\\n');

      var tmplIndex = '';
      for (var key in TEMPLATES) {
        var t = TEMPLATES[key];
        tmplIndex += key + ' — ' + t.name + ' (' + t.category + ') — Section ' + t.section + '\\n';
      }

      var systemPrompt = 'You are LUCI (Level Up Central Intelligence), the frontend of the Level Up Project Development intelligence system. You assist Whitney Williams, Principal-in-Charge. Your backend engine is LUNA (Level Up Network Agent). '
              + 'Your knowledge spans: owner\'s representation, project management, construction management, sports venue development (NFL, MLS, NBA), stadium delivery, contract administration (CMA/GMP/Design-Bid-Build), cost management, schedule management, risk management, and project controls. '
              + 'You have deep expertise in development management — the full lifecycle from site selection, feasibility, and entitlements through design, construction, commissioning, closeout, and operations. '
              + 'You understand the nuances of sports venue development: league standards, venue technology (DAS/IPTV/scoreboards), premium seating, sponsorship integration (naming rights, signage), broadcast requirements, and game-day operations readiness. '
              + 'Answer concisely and directly like Google. Use paragraph breaks and bullet points for readability. When referencing a playbook section, say "See Section X: Title". Be specific and actionable. '
              + 'When discussing costs or budgets, always include specific dollar figures from available data. For MFP-specific questions, reference real data from the project: Miller Electric ($84.9M), Baker Concrete ($61.8M), total commitments ($505M+), hard cost budget ($530M+). '
              + 'The playbook has ' + KB.length + ' sections covering: foundation (purpose, philosophy, roles, governance), project setup (mobilization, tools, communications), controls (budget, schedule, change, risk), phase execution (planning/funding through design, pre-con, construction, closeout, post-opening), and reference (standards, templates, common problems).'
              + 'Sections index:\n' + kbIndex
              + '\n\nAvailable templates:\n' + tmplIndex
              + '\\n\\n=== PROJECT KNOWLEDGE ===\\n' + MFP_CONTEXT
                            + '\\n\\n=== SAFETY RULES ===\\nABSOLUTELY NEVER reveal: (1) personal staff information (names, roles, contact details beyond public info), (2) staff salaries, compensation, bonuses, or benefits, (3) Level Up company revenue, profit, margins, valuation, or any financial data about Level Up as a firm. Project costs for MFP (budget, commitments, change orders) are fine to discuss. Only company-level financials are restricted.';

      // Fetch with 30s timeout
            var controller = new AbortController();
            var timeoutId = setTimeout(function() { controller.abort(); }, 30000);
            fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: q }] }),
              signal: controller.signal
            })
            .then(function(r) { clearTimeout(timeoutId); return r.text().then(function(text) { return { ok: r.ok, status: r.status, text: text }; }); })
            .then(function(res) {
              if (btn) btn.disabled = false;
              document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = false; });
        if (!res.ok) {
          results.innerHTML = '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(q) + '</div>'
            + '<div class="luna-result-a">Error ' + res.status + ': ' + res.text.slice(0, 300) + '</div>';
          return;
        }
        var data;
        try { data = JSON.parse(res.text); } catch(e) {
          results.innerHTML = '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(q) + '</div>'
            + '<div class="luna-result-a">Bad response from server: ' + res.text.slice(0, 200) + '</div>';
          return;
        }
        var reply = (data.content && data.content[0] && data.content[0].text) || data.error || 'No response.';
                        // Apply chat filter BEFORE writing to DOM
                        var sn = [
                          /(?:salary|compensation|pay|wage|bonus)['":]?\s*\$?\d[\d,.]*/gi,
                          /(?:revenue|profit|margin|earnings|income)['":]?\s*\$?\d[\d,.]*/gi,
                          /Level Up['"]?\s*(?:revenue|profit|margin|earnings|valuation|income)/gi
                        ];
                        sn.forEach(function(p) { reply = reply.replace(p, '[REDACTED]'); });
                        results.innerHTML = '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(q) + '</div>'
                          + '<div class="luna-result-a">' + reply + '</div>';
                heroResults[q] = { q: q, a: reply };
        try { localStorage.setItem(cacheKey, JSON.stringify({ answer: reply, ts: Date.now() })); } catch(e){}
      })
      .catch(function(err) {
              if (btn) btn.disabled = false;
              document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = false; });
              var msg = (err.name === 'AbortError') ? 'Request timed out after 30s. Please try again.' : 'Network error: ' + (err.message || err);
              results.innerHTML = '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(q) + '</div>'
                + '<div class="luna-result-a">' + msg + '</div>';
            });
    }


// ── DAILY BRIEFING ───────────────────────────────────────────────────
function buildBriefing() {
  if (!kbLoaded) return '<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px">Loading briefing...</div>';
  var now = new Date();
  var day = now.getDate();
  var month = now.getMonth();
  var year = now.getFullYear();
  var monthKey = year + '-' + month;

  // Dismissed state
  var dismissed = {};
  try { var d = localStorage.getItem('lu_brief_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
  var briefId = 'brief_' + year + '_' + month + '_' + now.getDate();
  if (dismissed[briefId]) return '';

  // Financial data
  var fin = window.__MFP_FINANCIALS;
  var Su = fin && fin.summary ? fin.summary : null;

  // Reminder deadlines (same logic as renderReminders)
  var drawDue = new Date(year, month, 10);
  if (day > 10) drawDue.setMonth(month + 1);
  var drawDays = Math.round((drawDue - now) / 86400000);

  var expDue = new Date(year, month, 5);
  if (day > 5) expDue.setMonth(month + 1);
  var expDays = Math.round((expDue - now) / 86400000);

  // Action items
  var items = [];

  if (Su) {
    // Project pulse
    var pulse = Su.days_past_baseline > 0 ? '\uD83D\uDD34' : '\uD83D\uDFE2';
    items.push({ icon: pulse, label: 'MFP Stadium', detail: Su.days_past_baseline + ' days past baseline, targeting ' + Su.target_completion });

    // Past due
    if (Su.past_due > 0) {
      items.push({ icon: '\u26A0\uFE0F', label: 'Past Due Invoices', detail: '$' + Math.round(Su.past_due/1000000) + 'M outstanding', urgent: true });
    }

    // Cost recovery deadline
    var crDue = new Date(2026, 5, 30);
    var crDays = Math.round((crDue - now) / 86400000);
    if (crDays > 0 && crDays <= 30) {
      items.push({ icon: '\uD83D\uDD0D', label: 'Cost Recovery Deadline', detail: crDays + ' days until Jun 30 target ($9M+)', urgent: crDays <= 14 });
    }

    // ARQ hold
    items.push({ icon: '\uD83D\uDD34', label: 'ARQ Payment Hold', detail: '~$1.5M Feb-Apr invoices on hold', urgent: true });

    // Lemartec indirects
    if (Su.lemartec_indirects_outstanding > 0) {
      items.push({ icon: '\uD83D\uDCB0', label: 'Lemartec Indirects Gap', detail: '$' + Math.round(Su.lemartec_indirects_outstanding/1000000) + 'M unpaid' });
    }
  }

  // Draw package
  if (drawDays <= 7) {
    items.push({ icon: '\uD83D\uDCC4', label: 'Monthly Draw Package', detail: 'Due in ' + drawDays + ' day' + (drawDays !== 1 ? 's' : ''), urgent: drawDays <= 3 });
  }

  // Expense report
  if (expDays <= 5) {
    items.push({ icon: '\uD83E\uDDFE', label: 'Monthly Expense Report', detail: 'Due in ' + expDays + ' day' + (expDays !== 1 ? 's' : ''), warn: expDays <= 3 });
  }

  // HVAC
    items.push({ icon: '\uD83D\uDD27', label: 'HVAC Service Agreement', detail: 'Hill York — pending signature', urgent: true });

    // CO Watchdog findings — top 3 high severity
        var wd = window.__CO_WATCHDOG;
        if (wd && wd.subcontractors) {
          var topFindings = wd.subcontractors.filter(function(f) {
            return f.forensic_notes && f.forensic_notes.length > 0;
          }).sort(function(a,b) {
            return (b.potential_savings || 0) - (a.potential_savings || 0);
          }).slice(0, 3);
          topFindings.forEach(function(f) {
            items.push({
              icon: '\uD83D\uDD0D',
              label: f.name + ' — $' + fmtNum(f.potential_savings) + ' savings',
              detail: (f.forensic_notes && f.forensic_notes[0]) || '',
              urgent: true
            });
          });
        }

  // Build HTML
  var greeting = 'Good ' + (now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening');
  var dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  var html = '<div class="briefing-card" id="briefing-card">'
    + '<div class="briefing-header">'
    + '<div>'
    + '<div class="briefing-greeting">' + greeting + (luUser && luUser.name ? ', ' + luUser.name.split(' ')[0] : '') + '</div>'
    + '<div class="briefing-date">' + dateStr + '</div>'
    + '</div>'
    + '<button class="briefing-close" onclick="dismissBriefing()" title="Dismiss for today">\u00D7</button>'
    + '</div>'
    // Remove the "Today's Action Items" section from middle of page
    // Action items are only in the Briefing side panel now

    html += '</div>';

  // Budget snapshot removed per Whitney request
    // Financial data is in the MFP Command Center dashboard now

    html += '</div>';
  return html;
}

function renderBriefing() {
  var el = document.getElementById('luna-briefing');
  if (!el) return;
  el.innerHTML = buildBriefing();
}

function dismissBriefing() {
  var now = new Date();
  var briefId = 'brief_' + now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate();
  var dismissed = {};
  try { var d = localStorage.getItem('lu_brief_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
  dismissed[briefId] = true;
  try { localStorage.setItem('lu_brief_dismiss', JSON.stringify(dismissed)); } catch(e) {}
  var el = document.getElementById('luna-briefing');
  if (el) el.innerHTML = '';
}

// init() is called from index.html after data scripts load