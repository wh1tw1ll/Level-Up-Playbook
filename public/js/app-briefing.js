// js/app-briefing.js — The Daily Operating Picture
// A digestible, single-scroll briefing that tells Whitney what matters today.
// Loaded from /api/briefing — no STORE dependency.

/* global escapeHtml */
function renderBriefingView() {
  const container = document.getElementById('briefing-content');
  if (!container) return;

  container.innerHTML = '<div class="briefing-skeleton"><div class="briefing-loader"></div><span>Assembling your briefing...</span></div>';

  // ── FETCH BRIEFING DATA ──
  fetch('/api/briefing')
    .then(function(r) {
      if (!r.ok) throw new Error('Status ' + r.status);
      return r.json();
    })
    .then(function(data) {
      renderBriefing(container, data);
    })
    .catch(function(err) {
      container.innerHTML = '<div class="briefing-empty"><p>Could not load briefing.</p><p class="briefing-empty-sub">' + escapeHtml(err.message) + '</p><button class="briefing-retry-btn" onclick="renderBriefingView()">Retry</button></div>';
    });
}

// ── RENDER ──
function renderBriefing(container, data) {
  var html = '';

  // ═══ SECTION 1: GREETING ═══
  html += '<div class="briefing-header">';
  html += '  <div class="briefing-greeting">☕ ' + escapeHtml(data.greeting) + ', <strong>' + escapeHtml(data.name) + '</strong></div>';
  html += '  <div class="briefing-date">' + escapeHtml(data.dayLabel) + '</div>';
  html += '</div>';

  // ═══ SECTION 2: MEETING TIMELINE ═══
  var hasMeetings = data.events && data.events.length > 0;
  var meetingCount = hasMeetings ? data.events.length : 0;

  html += '<div class="briefing-card" data-expand="meetings">';
  html += '  <div class="briefing-card-header" onclick="toggleBriefingSection(this)">';
  html += '    <span class="briefing-card-icon">📅</span>';
  html += '    <span class="briefing-card-title">Today\'s Schedule</span>';
  html += '    <span class="briefing-card-badge">' + meetingCount + '</span>';
  html += '    <span class="briefing-card-toggle">▾</span>';
  html += '  </div>';
  html += '  <div class="briefing-card-body" style="display:' + (hasMeetings ? 'block' : 'none') + '">';

  if (hasMeetings) {
    for (var i = 0; i < data.events.length; i++) {
      var ev = data.events[i];
      var time = formatBriefingTime(ev.start);
      var meetingClass = ev.isOnline ? 'briefing-event-online' : '';

      html += '    <div class="briefing-event ' + meetingClass + '">';
      html += '      <div class="briefing-event-time">' + escapeHtml(time) + '</div>';
      html += '      <div class="briefing-event-dot"></div>';
      html += '      <div class="briefing-event-info">';
      html += '        <div class="briefing-event-title">' + escapeHtml(ev.subject) + '</div>';
      if (ev.location) {
        html += '        <div class="briefing-event-location">📍 ' + escapeHtml(ev.location) + '</div>';
      }
      if (ev.isOnline) {
        html += '        <div class="briefing-event-location">💻 Online meeting</div>';
      }
      html += '      </div>';
      html += '    </div>';
    }
  } else {
    html += '    <div class="briefing-empty-section">';
    html += '      <p>No meetings scheduled today.</p>';
    html += '    </div>';
  }

  html += '  </div>';
  html += '</div>';
  html += '';

  // ═══ SECTION 3: ATTENTION ITEMS ═══
  var hasAttention = data.attentionItems && data.attentionItems.length > 0;
  var criticalCount = 0;
  var highCount = 0;
  if (hasAttention) {
    for (var j = 0; j < data.attentionItems.length; j++) {
      if (data.attentionItems[j].level === 'critical') criticalCount++;
      else if (data.attentionItems[j].level === 'high') highCount++;
    }
  }

  var autoExpandAttention = criticalCount > 0 || highCount > 0;

  html += '<div class="briefing-card' + (criticalCount > 0 ? ' briefing-card-alert' : '') + '" data-expand="attention">';
  html += '  <div class="briefing-card-header" onclick="toggleBriefingSection(this)">';
  if (criticalCount > 0) {
    html += '    <span class="briefing-card-icon">⚠️</span>';
  } else if (highCount > 0) {
    html += '    <span class="briefing-card-icon">📋</span>';
  } else {
    html += '    <span class="briefing-card-icon">✓</span>';
  }
  html += '    <span class="briefing-card-title">' + (criticalCount > 0 ? 'Needs Your Attention' : highCount > 0 ? 'Due Today' : 'All Clear') + '</span>';
  if (hasAttention) {
    html += '    <span class="briefing-card-badge briefing-badge-' + (criticalCount > 0 ? 'danger' : 'warn') + '">' + data.attentionItems.length + '</span>';
  }
  html += '    <span class="briefing-card-toggle">▾</span>';
  html += '  </div>';
  html += '  <div class="briefing-card-body" style="display:' + (autoExpandAttention ? 'block' : 'none') + '">';

  if (hasAttention) {
    for (var k = 0; k < data.attentionItems.length; k++) {
      var item = data.attentionItems[k];
      var dotClass = 'briefing-item-dot-' + item.level;
      var projectClass = getProjectClass(item.project);

      html += '    <div class="briefing-item ' + dotClass + '">';
      html += '      <div class="briefing-item-dot ' + dotClass + '"></div>';
      html += '      <div class="briefing-item-body">';
      html += '        <div class="briefing-item-title">' + escapeHtml(item.title) + '</div>';
      html += '        <div class="briefing-item-meta">';
      html += '          <span class="briefing-item-tag ' + projectClass + '">' + escapeHtml(item.project || 'General') + '</span>';
      html += '          <span class="briefing-item-label ' + dotClass + '">' + escapeHtml(item.label) + '</span>';
      if (item.owner) {
        html += '          <span class="briefing-item-owner">👤 ' + escapeHtml(item.owner) + '</span>';
      }
      html += '        </div>';
      html += '      </div>';
      html += '    </div>';
    }
  } else {
    html += '    <div class="briefing-empty-section">';
    html += '      <p>✓ Nothing urgent today.</p>';
    html += '    </div>';
  }

  html += '  </div>';
  html += '</div>';

  // ═══ SECTION 4: LUNA NOTE ═══
  if (data.lunaNote) {
    html += '<div class="briefing-luna-card">';
    html += '  <div class="briefing-luna-icon">' + escapeHtml(data.lunaNote.icon) + '</div>';
    html += '  <div class="briefing-luna-text">' + escapeHtml(data.lunaNote.text) + '</div>';
    html += '</div>';
  }

  // ═══ SECTION 5: PROJECT PULSE ═══
  var hasPulse = data.projectPulse && data.projectPulse.length > 0;

  html += '<div class="briefing-card" data-expand="pulse">';
  html += '  <div class="briefing-card-header" onclick="toggleBriefingSection(this)">';
  html += '    <span class="briefing-card-icon">📊</span>';
  html += '    <span class="briefing-card-title">Project Pulse</span>';
  if (hasPulse) {
    html += '    <span class="briefing-card-badge">' + data.projectPulse.length + '</span>';
  }
  html += '    <span class="briefing-card-toggle">▾</span>';
  html += '  </div>';
  html += '  <div class="briefing-card-body" style="display:' + (hasPulse ? 'block' : 'none') + '">';

  if (hasPulse) {
    for (var p = 0; p < data.projectPulse.length; p++) {
      var pulse = data.projectPulse[p];
      var healthIcon = pulse.health === 'green' ? '🟢' : '🔶';
      var projectClass = getProjectClass(pulse.name);

      html += '    <div class="briefing-pulse-row">';
      html += '      <div class="briefing-pulse-health">' + healthIcon + '</div>';
      html += '      <div class="briefing-pulse-info">';
      html += '        <div class="briefing-pulse-name ' + projectClass + '">' + escapeHtml(pulse.name) + '</div>';
      html += '        <div class="briefing-pulse-summary">' + escapeHtml(pulse.summary) + '</div>';
      html += '      </div>';
      html += '    </div>';
    }
  }

  html += '  </div>';
  html += '</div>';

  // ═══ SECTION 6: FOOTER ═══
  html += '<div class="briefing-footer">';
  html += '  <span>Last updated: ' + escapeHtml(formatBriefingTime(new Date().toISOString())) + '</span>';
  html += '  <button class="briefing-refresh-btn" onclick="renderBriefingView()">↻ Refresh</button>';
  html += '</div>';

  container.innerHTML = html;

  // Auto-scroll to attention section if urgent
  if (criticalCount > 0) {
    setTimeout(function() {
      var alertCard = container.querySelector('.briefing-card-alert');
      if (alertCard) alertCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

// ── HELPERS ──
function formatBriefingTime(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    var h = d.getHours();
    var m = String(d.getMinutes()).padStart(2, '0');
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ampm;
  } catch (e) { return ''; }
}

function getProjectClass(project) {
  if (!project) return 'tag-general';
  var p = project.toLowerCase();
  if (p.indexOf('mfp') !== -1 || p.indexOf('freedom') !== -1 || p.indexOf('miami') !== -1) return 'tag-mfp';
  if (p.indexOf('dova') !== -1) return 'tag-dova';
  if (p.indexOf('busines') !== -1 || p.indexOf('bd') !== -1 || p.indexOf('development') !== -1) return 'tag-business';
  if (p.indexOf('sphere') !== -1 || p.indexOf('kc') !== -1 || p.indexOf('chiefs') !== -1) return 'tag-sphere';
  if (p.indexOf('general') !== -1 || p.indexOf('personal') !== -1) return 'tag-general';
  return 'tag-general';
}

// ── SECTION TOGGLE ──
function toggleBriefingSection(header) {
  var card = header.closest('.briefing-card');
  if (!card) return;

  var body = card.querySelector('.briefing-card-body');
  var toggle = card.querySelector('.briefing-card-toggle');
  if (!body) return;

  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (toggle) toggle.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

// ── EXPOSE ──
window.renderBriefingView = renderBriefingView;
window.toggleBriefingSection = toggleBriefingSection;