// ── DECISION TREE INLINE ────────────────────────────────────────────
var dtPathInline = ['root'];
function renderDecisionTreeInline() {
  var body = document.getElementById('dt-body-inline');
  if (!body) return;
  var cur = typeof DT_TREE !== 'undefined' ? DT_TREE[dtPathInline[dtPathInline.length-1]] : null;
  if (!cur) { body.innerHTML = '<div style="padding:20px;color:var(--muted)">Decision tree not available.</div>'; return; }
  if (cur.answer) {
    body.innerHTML = '<div class="dt-answer">'+escapeHtml(cur.answer)+'</div>'+(cur.sections?'<div class="dt-meta">See sections: '+cur.sections.join(', ')+'</div>':'')+'<button class="btn-primary" onclick="dtResetInline()">Start over</button>';
    return;
  }
  body.innerHTML = '<div class="dt-q">'+escapeHtml(cur.q)+'</div>'+cur.opts.map(function(opt){return '<button class="dt-opt" onclick="dtChooseInline(\''+opt.next+'\')">'+escapeHtml(opt.label)+'</button>';}).join('')+(dtPathInline.length>1?'<button class="back-btn" onclick="dtBackInline()">← Back</button>':'');
}
function dtChooseInline(next) { dtPathInline.push(next); renderDecisionTreeInline(); }
function dtBackInline() { if (dtPathInline.length > 1) dtPathInline.pop(); renderDecisionTreeInline(); }
function dtResetInline() { dtPathInline = ['root']; renderDecisionTreeInline(); }

// ── INLINE PHASE GUIDE ──────────────────────────────────────────────
function renderPhaseGuideInline() {
  var body = document.getElementById('pg-body-inline');
  if (!body) return;
  if (typeof PHASE_GUIDE === 'undefined') { body.innerHTML = '<div style="padding:20px;color:var(--muted)">Phase Guide not loaded.</div>'; return; }
  var html = '';
  var phases = Object.keys(PHASE_GUIDE);
  phases.forEach(function(phase, idx) {
    var pid = 'pgi-phase-'+idx, data = PHASE_GUIDE[phase];
    html += '<div class="pg-phase"><button class="pg-phase-header" onclick="togglePgPhaseInline(\''+pid+'\')"><span class="pg-phase-chevron" id="'+pid+'-chev">▶</span><span>'+(data.icon||'📖')+' '+escapeHtml(phase)+'</span></button><div class="pg-phase-body" id="'+pid+'" style="display:none">';
    (data.items||[]).forEach(function(item){html+='<div class="pg-item">'+escapeHtml(item)+'</div>';});
    html += '</div></div>';
  });
  body.innerHTML = html;
}
function togglePgPhaseInline(pid) {
  var body = document.getElementById(pid), chev = document.getElementById(pid+'-chev');
  if (!body) return;
  var isHidden = body.style.display === 'none' || !body.style.display;
  body.style.display = isHidden ? 'block' : 'none';
  if (chev) chev.textContent = isHidden ? '▼' : '▶';
}
