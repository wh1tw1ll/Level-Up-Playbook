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
        var introText = "Hi " + (luUser && luUser.name ? luUser.name.split(' ')[0] : 'there') + ". I'm LUCI, your Project Intelligence engine. Ask me anything about the playbook, MFP, or DOVA Arena. Day 1 mobilization, change orders, punch list disputes, cost recovery audit, anything.";
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

  fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: q,
        history: chatHistory.slice(-6)
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

// ── BRIEFING SIDE PANEL ──────────────────────────────────────────
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
    refreshBriefingData();
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
  var helpBtn = document.getElementById('help-btn');
  if (panel) {
    panel.style.display = 'flex';
    panel.scrollTop = 0;
    setTimeout(function() { panel.classList.remove('closed'); }, 10);
  }
  if (toggle) toggle.style.display = 'none';
  if (helpBtn) helpBtn.style.display = 'none';
  reminderPanelOpen = true;
  renderUnifiedBriefing();
  startPanelAutoRefresh();
}

function closeReminderPanel() {
  var panel = document.getElementById('reminder-panel');
  var toggle = document.getElementById('reminder-toggle');
  var helpBtn = document.getElementById('help-btn');
  if (panel) {
    panel.classList.add('closed');
    setTimeout(function() {
      panel.style.display = 'none';
      if (toggle) toggle.style.display = 'flex';
    }, 300);
  }
  if (helpBtn) {
    // Only re-show if clippy isn't already visible
    var clippy = document.getElementById('luna-clippy');
    if (!clippy || clippy.style.display === 'none') {
      setTimeout(function() { helpBtn.style.display = 'flex'; }, 350);
    }
  }
    reminderPanelOpen = false;
    stopPanelAutoRefresh();
}

// ── UNIFIED DAILY BRIEFING (replaces the three-tab layout) ────────

function renderUnifiedBriefing() {
  var el = document.getElementById('reminder-panel-body');
  if (!el) return;
  var footer = document.getElementById('reminder-panel-footer-text');
  if (footer) footer.textContent = 'Loading...';

  el.innerHTML = '<div class="reminder-loader"></div>';

  fetch('/api/briefing')
    .then(function(r) {
      if (!r.ok) throw new Error('Status ' + r.status);
      return r.json();
    })
    .then(function(data) {
      var html = '';

      // ── 1. HEADER: greeting + date ──
      html += '<div style="margin-bottom:12px">';
      html += '  <div style="font-size:15px;font-weight:700;color:var(--charcoal)">☕ ' + escapeHtml(data.greeting) + ', <strong>' + escapeHtml(data.name) + '</strong></div>';
      html += '  <div style="font-size:12px;color:var(--muted);margin-top:2px">' + escapeHtml(data.dayLabel) + '</div>';
      html += '</div>';

      // ── 2. WEATHER ──
      if (data.weather && data.weather.alert) {
        html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:12px;display:flex;align-items:center;gap:8px;line-height:1.4">';
        html += '  <span style="font-size:16px;flex-shrink:0">🌤</span>';
        html += '  <span style="color:var(--charcoal)">' + escapeHtml(data.weather.alert) + '</span>';
        html += '</div>';
      }

      // ── 3. LUNA NOTE ──
      if (data.lunaNote) {
        html += '<div style="background:var(--teal-light);border:1px solid var(--teal);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:12px;display:flex;align-items:flex-start;gap:6px;line-height:1.5">';
        html += '  <span style="font-size:14px;flex-shrink:0;margin-top:1px">' + escapeHtml(data.lunaNote.icon) + '</span>';
        html += '  <span style="color:var(--charcoal)">' + escapeHtml(data.lunaNote.text) + '</span>';
        html += '</div>';
      }

      // ── 4. TODAY'S MEETINGS ──
      var hasMeetings = data.events && data.events.length > 0;
      if (hasMeetings) {
        html += '<div style="margin-bottom:10px">';
        html += '  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">Today\u2019s Meetings</div>';
        for (var i = 0; i < data.events.length; i++) {
          var ev = data.events[i];
          var start = ev.start ? new Date(ev.start) : null;
          var timeStr = start ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : 'all day';
          var loc = ev.location || (ev.isOnline ? 'Online' : '');
          html += '  <div style="display:flex;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border);align-items:flex-start">';
          html += '    <div style="font-weight:700;color:var(--teal);min-width:52px;flex-shrink:0">' + escapeHtml(timeStr) + '</div>';
          html += '    <div style="flex:1;min-width:0">';
          html += '      <div style="font-weight:600;color:var(--charcoal)">' + escapeHtml(ev.subject) + '</div>';
          if (loc) html += '      <div style="font-size:11px;color:var(--muted);margin-top:1px">' + escapeHtml(loc) + '</div>';
          html += '    </div>';
          html += '  </div>';
        }
        html += '</div>';
      }

      // ── 5. NEEDS ATTENTION (critical + high only, max 10) ──
      var urgentItems = [];
      if (data.attentionItems) {
        for (var a = 0; a < data.attentionItems.length; a++) {
          var item = data.attentionItems[a];
          if (item.level === 'critical' || item.level === 'high') {
            urgentItems.push(item);
            if (urgentItems.length >= 10) break;
          }
        }
      }
      if (urgentItems.length > 0) {
        html += '<div style="margin-bottom:10px">';
        html += '  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">Needs Attention</div>';
        for (var b = 0; b < urgentItems.length; b++) {
          var it = urgentItems[b];
          var dot = it.level === 'critical' ? '🔴' : '🟡';
          var projTag = it.project ? ' <span style="font-size:10px;background:var(--cool);padding:1px 5px;border-radius:4px;color:var(--muted)">' + escapeHtml(it.project) + '</span>' : '';
          html += '  <div style="display:flex;gap:8px;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border);align-items:flex-start">';
          html += '    <span style="font-size:12px;flex-shrink:0;margin-top:1px">' + dot + '</span>';
          html += '    <div style="flex:1;min-width:0">';
          html += '      <div style="font-weight:600;color:var(--charcoal);line-height:1.4">' + escapeHtml(it.title) + projTag + '</div>';
          html += '      <div style="font-size:11px;color:var(--muted);margin-top:1px">' + escapeHtml(it.label || '') + (it.owner ? ' · ' + escapeHtml(it.owner) : '') + '</div>';
          html += '    </div>';
          html += '  </div>';
        }
        html += '</div>';
      }

      // ── 6. PROJECT PULSE ──
      if (data.projectPulse && data.projectPulse.length > 0) {
        html += '<div style="margin-bottom:8px">';
        html += '  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">Project Pulse</div>';
        for (var p = 0; p < data.projectPulse.length; p++) {
          var pulse = data.projectPulse[p];
          var healthIcon = pulse.health === 'green' ? '🟢' : pulse.health === 'amber' ? '🟡' : '🔴';
          html += '  <div style="display:flex;gap:6px;padding:3px 0;font-size:12px">';
          html += '    <span style="font-size:12px;flex-shrink:0">' + healthIcon + '</span>';
          html += '    <span style="color:var(--charcoal)"><strong>' + escapeHtml(pulse.name) + '</strong> &#8212; ' + escapeHtml(pulse.summary) + '</span>';
          html += '  </div>';
        }
        html += '</div>';
      }

      // ── 7. DECISIONS NEEDED (top 5) ──
      if (data.decisions && data.decisions.length > 0) {
        html += '<div style="margin-bottom:8px">';
        html += '  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">Decisions Needed</div>';
        var maxD = Math.min(data.decisions.length, 5);
        for (var d = 0; d < maxD; d++) {
          var dec = data.decisions[d];
          html += '  <div style="display:flex;gap:8px;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border);align-items:flex-start">';
          html += '    <span style="font-size:12px;flex-shrink:0;margin-top:1px">✋</span>';
          html += '    <div style="flex:1;min-width:0">';
          html += '      <div style="font-weight:600;color:var(--charcoal);line-height:1.4">' + escapeHtml(dec.title) + '</div>';
          html += '      <div style="font-size:11px;color:var(--muted);margin-top:1px">' + (dec.project ? escapeHtml(dec.project) + ' · ' : '') + escapeHtml(dec.label || '') + '</div>';
          html += '    </div>';
          html += '  </div>';
        }
        html += '</div>';
      }

      // ── 8. META + ACTION BUTTONS ──
      html += '<div style="font-size:10px;color:var(--muted);margin-bottom:8px;padding:4px 0">';
      html += '  ' + (data.meta ? escapeHtml(String(data.meta.totalOpenTasks)) + ' open tasks · ' + escapeHtml(String(data.meta.totalOverdue)) + ' overdue' : '') + '';
      html += '</div>';

      html += '<div style="display:flex;gap:6px;padding-top:8px;border-top:1px solid var(--border)">';
      if (data.audioSummary) {
        html += '  <button class="reminder-tab" onclick="playBriefingAudio(this)" data-text="' + escapeHtml(data.audioSummary) + '" style="flex:1;padding:6px 8px;font-size:11px">🎧 Listen</button>';
      }
      if (data.yesterday) {
        html += '  <button class="reminder-tab" onclick="renderBriefingDate(\'' + escapeHtml(data.yesterday) + '\')" style="flex:1;padding:6px 8px;font-size:11px">📄 Yesterday</button>';
      }
      html += '  <button class="reminder-tab" onclick="renderUnifiedBriefing()" style="flex:0;padding:6px 8px;font-size:11px">↻</button>';
      html += '</div>';

      el.innerHTML = html;
      if (footer) footer.textContent = 'Updated ' + formatBriefingTime(new Date().toISOString());
    })
    .catch(function(err) {
      el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--muted);font-size:12px">Could not load briefing.<br><button class="reminder-tab" onclick="renderUnifiedBriefing()" style="margin-top:6px">Retry</button></div>';
      if (footer) footer.textContent = 'Briefing unavailable';
    });
}

// ⏪ Briefing for a specific date (kept for "Yesterday" button)
function renderBriefingDate(dateStr) {
  var el = document.getElementById('reminder-panel-body');
  if (!el) return;
  var footer = document.getElementById('reminder-panel-footer-text');
  if (footer) footer.textContent = '📜 Briefing';
  el.innerHTML = '<div class="reminder-loader"></div>';
  fetch('/api/briefing?date=' + encodeURIComponent(dateStr))
    .then(function(r) {
      if (!r.ok) throw new Error('Status ' + r.status);
      return r.json();
    })
    .then(function(data) {
      data.name = data.name || 'Whitney';
      data.greeting = data.greeting || 'Good morning';
      data.dayLabel = data.dayLabel || dateStr;
      var html = '';
      html += '<div style="margin-bottom:10px"><button class="reminder-tab" onclick="renderUnifiedBriefing()" style="padding:4px 10px;font-size:11px">← Back to Today</button></div>';
      html += '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:6px">📜 ' + escapeHtml(data.dayLabel) + '</div>';
      if (data.lunaNote) {
        html += '<div style="background:var(--teal-light);border:1px solid var(--teal);border-radius:8px;padding:8px 10px;margin:10px 0;font-size:12px;line-height:1.5">' + escapeHtml(data.lunaNote.text) + '</div>';
      }
      if (!data.lunaNote) {
        html += '<div style="color:var(--muted);font-size:12px;margin-top:12px">No briefing data available for this date.</div>';
      }
      el.innerHTML = html;
      if (footer) footer.textContent = 'Historical — ' + dateStr;
    })
    .catch(function(err) {
      el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--muted);font-size:12px">Could not load briefing for this date.<br><button class="reminder-tab" onclick="renderUnifiedBriefing()" style="margin-top:8px">← Back to Today</button></div>';
      if (footer) footer.textContent = 'Error loading ' + dateStr;
    });
}

// ── PANEL AUTO-REFRESH ────────────────────────────────────────────
var panelRefreshTimer = null;
var PANEL_REFRESH_INTERVAL = 60000; // 60s

function startPanelAutoRefresh() {
  stopPanelAutoRefresh();
  if (isWhitney()) {
    panelRefreshTimer = setInterval(function() {
      var el = document.getElementById('reminder-panel-body');
      if (el && el.style.display !== 'none') {
        renderUnifiedBriefing();
      }
    }, PANEL_REFRESH_INTERVAL);
  }
}

function stopPanelAutoRefresh() {
  if (panelRefreshTimer) {
    clearInterval(panelRefreshTimer);
    panelRefreshTimer = null;
  }
}

function refreshBriefingData() {
  // Fetch once on init to warm the cache
  fetch('/api/briefing').catch(function() {});
}

// ── AUDIO BRIEFING ──────────────────────────────────────────────────
function playBriefingAudio(btn) {
  var text = btn && btn.getAttribute('data-text');
  if (!text) return;
  // Use browser SpeechSynthesis API — no API key needed
  var synth = window.speechSynthesis;
  if (!synth) {
    alert('Speech not supported in this browser.');
    return;
  }
  // Cancel any ongoing speech
  synth.cancel();
  var utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  // Try female English voice — prefer modern/clear voices
  var voices = synth.getVoices();
  var preferred = voices.filter(function(v) {
    return v.lang.indexOf('en') === 0 && (v.name.indexOf('Female') >= 0 || v.name.indexOf('female') >= 0);
  })[0] || voices.filter(function(v) {
    return v.lang.indexOf('en') === 0 && v.name.indexOf('Samantha') >= 0;
  })[0] || voices.filter(function(v) {
    return v.lang.indexOf('en') === 0 && v.name.indexOf('Google UK') >= 0;
  })[0] || voices.filter(function(v) {
    return v.lang.indexOf('en') === 0 && v.name.indexOf('Google US') >= 0;
  })[0] || voices.filter(function(v) {
    return v.lang.indexOf('en') === 0 && v.name.indexOf('Microsoft') >= 0 && v.name.indexOf('Natural') >= 0;
  })[0];
  if (preferred) utterance.voice = preferred;
  btn.textContent = '🔊 Playing...';
  utterance.onend = function() {
    btn.textContent = '🎧 Listen';
  };
  utterance.onerror = function() {
    btn.textContent = '🎧 Listen';
  };
  synth.speak(utterance);
}

function formatBriefingTime(isoStr) {
  try {
    var d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  } catch(e) { return ''; }
}

// ── LUCI HERO (default home view) ────────────────────────────────
    function renderHero() {
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

      var ddHTML = '<div class="luna-hero-dropdown-inner">';
      for (var ri = 0; ri < Math.min(results.length, 12); ri++) {
        var r = results[ri];
        var onClick = '';
        if (r.type === 'playbook') onClick = 'setView(\'playbook\');jumpTo(\'' + r.id + '\');return false';
        else if (r.type === 'template') onClick = 'openTemplatePreview(\'' + escapeHtml(String(r.id).replace(/'/g,"\\'")) + '\');return false';
        else if (r.type === 'project') onClick = 'setView(\'' + r.id + '\');return false';
        else if (r.type === 'contract') onClick = 'setView(\'playbook\');jumpTo(\'c' + r.id + '\');return false';
        else if (r.type === 'kb') onClick = 'setView(\'playbook\');jumpTo(\'' + r.id + '\');return false';
        ddHTML += '<div class="luna-hero-dd-item" onclick="' + onClick + '">'
          + '<span class="luna-hero-dd-icon">' + (r.type==='template'?'📑':r.type==='project'?'🏟':'📄') + '</span>'
          + '<div class="luna-hero-dd-text"><div>' + hl(r.label) + '</div>'
          + '<div class="luna-hero-dd-desc">' + hl(r.preview) + '</div></div>'
          + '<span class="luna-hero-dd-src">' + r.type.substring(0,4).toUpperCase() + '</span>'
          + '</div>';
      }
      ddHTML += '</div>';
      dd.innerHTML = ddHTML;
      dd.classList.add('show');
    }

    function heroDoAsk(q) {
      var results = document.getElementById('luna-hero-results');
      if (!results) return;
      var btn = document.querySelector('.luna-hero-btn');
      if (btn) btn.disabled = true;
      var qDiv = document.createElement('div');
      qDiv.className = 'luna-result-q';
      qDiv.innerHTML = '<span class="luna-result-q-icon">Q:</span>' + escapeHtml(q);
      results.appendChild(qDiv);
      var aDiv = document.createElement('div');
      aDiv.className = 'luna-result-a loading';
      aDiv.textContent = '•••';
      results.appendChild(aDiv);
      results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, system: 'You are a construction project management assistant. Answer concisely with specific data when available. Use markdown for formatting: **bold** for emphasis.' })
      })
      .then(function(r) {
        return r.text().then(function(text) { return { ok: r.ok, status: r.status, text: text }; });
      })
      .then(function(res) {
        if (res.ok) {
          try { var data = JSON.parse(res.text); var reply = ((data.content && data.content[0] && data.content[0].text) || data.error || 'No response.'); aDiv.innerHTML = formatLunaResponse(reply); aDiv.className = 'luna-result-a'; heroResults[q] = reply; } catch(e) { aDiv.innerHTML = '<strong>Error parsing response.</strong>'; aDiv.className = 'luna-result-a'; }
        } else {
          aDiv.innerHTML = '<strong>Error ' + res.status + '</strong>: ' + res.text.substring(0, 200); aDiv.className = 'luna-result-a';
        }
        if (btn) btn.disabled = false;
      })
      .catch(function(err) {
        aDiv.innerHTML = '<strong>Network error</strong>: ' + err.message; aDiv.className = 'luna-result-a'; if (btn) btn.disabled = false;
      });
    }

    var heroResults = {};

    function heroQuick(q) {
      var inp = document.getElementById('luna-hero-input');
      if (inp) inp.value = q;
      heroSearch();
    }

    // ── LUCI init() called from index.html ──
    function luciInit() {
      // Ensure data globals exist
      if (typeof KB === 'undefined' || typeof TEMPLATES === 'undefined') {
        console.warn('LUCI: KB/TEMPLATES not loaded yet, will retry');
        setTimeout(luciInit, 500);
        return;
      }
      kbLoaded = true;
      // Re-render any open view
      if (currentView) setView(currentView);
      // Init clippy/daily brief
      initDailyBriefing();
      // Status bar
      var footer = document.getElementById('footer-status-text');
      if (footer) {
        var status = 'KB=' + KB.length;
        if (typeof CONTRACT_KB !== 'undefined' && CONTRACT_KB) status += ' · Contracts=' + CONTRACT_KB.length;
        if (luUser && luUser.authenticated) status += ' · Signed in';
        footer.textContent = 'JS OK · ' + status + ' · KB=' + KB.length;
      }

      // Render home page — currently no fixed stats bar
        // Update data sync timestamp
      var freqEl = document.querySelector('.luna-status-freq');
      if (freqEl) {
        freqEl.textContent = '';
      }
    var urlParams = new URLSearchParams(window.location.search);
    var authSuccess = urlParams.get('auth') === 'success';
    if (authSuccess && !luUser) {
      // Microsoft sign-in completed, let the auth check flow handle it
    }
    }

// init() is called from index.html after data scripts load