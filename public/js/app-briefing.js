// js/app-briefing.js — The Daily Operating Picture v2
// Weather, meetings, attention items, decisions, audio, yesterday's brief

/* global escapeHtml */

var briefingViewState = 'today';

function renderBriefingView(dateOverride) {
  var container = document.getElementById('briefing-content');
  if (!container) return;

  briefingViewState = dateOverride ? 'history' : 'today';

  container.innerHTML = '<div class="briefing-skeleton"><div class="briefing-loader"></div><span>Assembling your briefing...</span></div>';

  var url = '/api/briefing';
  if (dateOverride) url += '?date=' + encodeURIComponent(dateOverride);

  fetch(url)
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

  // ═══ SECTION 1: GREETING + DATE ═══
  html += '<div class="briefing-header">';
  if (data.isHistorical) {
    html += '  <div class="briefing-greeting">📜 Briefing for <strong>' + escapeHtml(data.dayLabel) + '</strong></div>';
    html += '  <div style="margin-top:8px"><button class="briefing-today-btn" onclick="renderBriefingView()">← Back to Today</button></div>';
  } else {
    html += '  <div class="briefing-greeting">☕ ' + escapeHtml(data.greeting) + ', <strong>' + escapeHtml(data.name) + '</strong></div>';
    html += '  <div class="briefing-date">' + escapeHtml(data.dayLabel) + '</div>';
  }
  html += '</div>';

  // ═══ SECTION 2: WEATHER ALERT ═══
  if (!data.isHistorical && data.weather) {
    var wx = data.weather;

    html += '<div class="briefing-weather-card">';
    html += '  <div class="briefing-weather-alert">' + escapeHtml(wx.alert || 'Weather data unavailable') + '</div>';
    if (wx.mfp && !data.isHistorical) {
      html += '  <div class="briefing-weather-detail">';
      html += '    <span class="briefing-wx-site tag-mfp">MFP</span>';
      html += '    <span>' + escapeHtml(wx.mfp.condition) + '</span>';
      html += '    <span>' + Math.round(wx.mfp.tempHigh) + '°/' + Math.round(wx.mfp.tempLow) + '°</span>';
      html += '    <span>' + wx.mfp.precipProb + '% rain</span>';
      html += '  </div>';
    }
    if (wx.dova && !data.isHistorical) {
      html += '  <div class="briefing-weather-detail">';
      html += '    <span class="briefing-wx-site tag-dova">DOVA</span>';
      html += '    <span>' + escapeHtml(wx.dova.condition) + '</span>';
      html += '    <span>' + Math.round(wx.dova.tempHigh) + '°/' + Math.round(wx.dova.tempLow) + '°</span>';
      html += '    <span>' + wx.dova.precipProb + '% rain</span>';
      html += '  </div>';
    }
    html += '</div>';
  }

  // ═══ SECTION 3: MEETING TIMELINE ═══
  var hasMeetings = data.events && data.events.length > 0;
  var meetingCount = hasMeetings ? data.events.length : 0;

  html += '<div class="briefing-card" data-expand="meetings">';
  html += '  <div class="briefing-card-header" onclick="toggleBriefingSection(this)">';
  html += '    <span class="briefing-card-icon">📅</span>';
  html += '    <span class="briefing-card-title">' + (data.isHistorical ? 'Meetings' : 'Today\'s Schedule') + '</span>';
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
    html += '    <div class="briefing-empty-section"><p>No meetings' + (data.isHistorical ? '' : ' scheduled today') + '.</p></div>';
  }
  html += '  </div>';
  html += '</div>';

  // ═══ SECTION 4: DECISION NEEDED ═══
  var hasDecisions = data.decisions && data.decisions.length > 0;

  html += '<div class="briefing-card' + (hasDecisions ? ' briefing-card-decision' : '') + '" data-expand="decisions">';
  html += '  <div class="briefing-card-header" onclick="toggleBriefingSection(this)">';
  html += '    <span class="briefing-card-icon">✋</span>';
  html += '    <span class="briefing-card-title">' + (hasDecisions ? 'Decision Needed' : 'Decisions') + '</span>';
  if (hasDecisions) {
    html += '    <span class="briefing-card-badge briefing-badge-decision">' + data.decisions.length + '</span>';
  }
  html += '    <span class="briefing-card-toggle">▾</span>';
  html += '  </div>';
  html += '  <div class="briefing-card-body" style="display:' + (hasDecisions ? 'block' : 'none') + '">';

  if (hasDecisions) {
    for (var d = 0; d < data.decisions.length; d++) {
      var dec = data.decisions[d];
      var projectClass = getProjectClass(dec.project);
      html += '    <div class="briefing-decision-item">';
      html += '      <div class="briefing-decision-marker">!</div>';
      html += '      <div class="briefing-decision-body">';
      html += '        <div class="briefing-decision-title">' + escapeHtml(dec.title) + '</div>';
      html += '        <div class="briefing-item-meta">';
      html += '          <span class="briefing-item-tag ' + projectClass + '">' + escapeHtml(dec.project || 'General') + '</span>';
      if (dec.label) {
        html += '          <span class="briefing-item-label briefing-item-label-critical">' + escapeHtml(dec.label) + '</span>';
      }
      html += '        </div>';
      html += '      </div>';
      html += '    </div>';
    }
  } else {
    html += '    <div class="briefing-empty-section"><p>✓ No items need your decision right now.</p></div>';
  }
  html += '  </div>';
  html += '</div>';

  // ═══ SECTION 5: ATTENTION ITEMS ═══
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
  } else if (hasAttention) {
    html += '    <span class="briefing-card-icon">📋</span>';
  } else {
    html += '    <span class="briefing-card-icon">✓</span>';
  }
  html += '    <span class="briefing-card-title">' + (criticalCount > 0 ? 'Needs Your Attention' : hasAttention ? 'Upcoming' : 'All Clear') + '</span>';
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
    html += '    <div class="briefing-empty-section"><p>' + (data.isHistorical ? 'No items for this date.' : '✓ Nothing urgent today.') + '</p></div>';
  }
  html += '  </div>';
  html += '</div>';

  // ═══ SECTION 6: LUNA NOTE (between cards, prominent) ═══
  if (data.lunaNote) {
    html += '<div class="briefing-luna-card">';
    html += '  <div class="briefing-luna-icon">' + escapeHtml(data.lunaNote.icon) + '</div>';
    html += '  <div class="briefing-luna-text">' + escapeHtml(data.lunaNote.text) + '</div>';
    html += '</div>';
  }

  // ═══ SECTION 7: PROJECT PULSE ═══
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

  // ═══ SECTION 8: FOOTER with audio + yesterday ═══
  html += '<div class="briefing-footer">';
  html += '  <div class="briefing-footer-left">';
  html += '    <span>Updated ' + escapeHtml(formatBriefingTime(new Date().toISOString())) + '</span>';

  if (!data.isHistorical && data.yesterday) {
    html += '    <button class="briefing-link-btn" onclick="renderBriefingView(\'' + escapeHtml(data.yesterday) + '\')">📄 Yesterday</button>';
  }

  html += '  </div>';
  html += '  <div class="briefing-footer-right">';

  if (!data.isHistorical && data.audioSummary && data.audioSummary.length > 20) {
    html += '    <button class="briefing-audio-btn" onclick="playBriefingAudio(this)" data-text="' + escapeHtml(data.audioSummary) + '">🎧 Listen</button>';
  }

  html += '    <button class="briefing-refresh-btn" onclick="renderBriefingView()">↻</button>';
  html += '  </div>';
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

// ── AUDIO BRIEFING (Web Speech API) ──
function playBriefingAudio(btn) {
  if (!btn) return;

  var text = btn.getAttribute('data-text');
  if (!text) return;

  // Check if already speaking
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    btn.textContent = '🎧 Listen';
    return;
  }

  var utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a good voice
  var voices = window.speechSynthesis.getVoices();
  var preferredVoice = null;
  for (var v = 0; v < voices.length; v++) {
    if (voices[v].name.indexOf('Samantha') !== -1 || voices[v].name.indexOf('Google US English') !== -1) {
      preferredVoice = voices[v];
      break;
    }
  }
  if (preferredVoice) utterance.voice = preferredVoice;

  utterance.onstart = function() {
    btn.textContent = '⏹ Stop';
  };

  utterance.onend = function() {
    btn.textContent = '🎧 Listen';
  };

  utterance.onerror = function() {
    btn.textContent = '🎧 Listen';
  };

  window.speechSynthesis.speak(utterance);
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
window.playBriefingAudio = playBriefingAudio;