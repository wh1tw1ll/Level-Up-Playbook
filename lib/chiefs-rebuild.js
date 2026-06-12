    // ── KC CHIEFS DASHBOARD (rebuild per spec v1.0) ────────────
    var _chiefsData = {};
    var _chiefsSheetMeta = {};
    var _chiefsTimers = [];
    var _chiefsSortState = {};
    var _chiefsLastRefresh = 0;
    var _chiefsRefreshTimer = null;
    var _chiefsSectionErrors = {};

    var CHIEFS_SHEET_URLS = {
      '01':'https://app.smartsheet.com/sheets/p8C7HVqp3RrvQWwxwFGxJc7P8jHjWxv755Ghcp81',
      '02':'','03':'','04':'','05':'','06':'','07':'','08':'','09':'','10':'','11':'','12':'','13':''
    };

    var CHIEFS_DOCS = [
      {label:'Executive Schedule',url:''},{label:'Budget Tracker',url:''},
      {label:'Procurement Log',url:''},{label:'OAC Minutes',url:''},
      {label:'Monthly Reports',url:''},{label:'Drawings',url:''},
      {label:'Pay Apps',url:''},{label:'Renderings',url:''},{label:'Site Photos',url:''}
    ];

    function chiefsFmtCurrency(val) {
      if (val == null || val === '') return '-';
      var n = parseFloat(String(val).replace(/[$,]/g,''));
      if (isNaN(n)) return '-';
      if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      return '$' + Math.round(n).toLocaleString();
    }

    function chiefsFmtDate(d) {
      if (!d) return '-';
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      var now = new Date();
      var dm = (now.getFullYear() - dt.getFullYear()) * 12 + now.getMonth() - dt.getMonth();
      if (dm > 12) return dt.toLocaleDateString('en-US', { month:'short', year:'numeric' });
      return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    }

    function chiefsStatusPill(status) {
      if (!status) return '<span class="chiefs-pill chiefs-pill-gray">---</span>';
      var s = String(status).toLowerCase().trim();
      if (['complete','awarded','on track','released','decided','healthy'].includes(s))
        return '<span class="chiefs-pill chiefs-pill-green">' + status + '</span>';
      if (['in progress','pending','in procurement','open','scheduled','medium'].includes(s))
        return '<span class="chiefs-pill chiefs-pill-gold">' + status + '</span>';
      if (['high','delayed','at risk','behind'].includes(s))
        return '<span class="chiefs-pill chiefs-pill-red">' + status + '</span>';
      return '<span class="chiefs-pill chiefs-pill-gray">' + (status || '---') + '</span>';
    }

    function chiefsRatingPill(rating) {
      if (!rating) return '<span class="chiefs-pill chiefs-pill-gray">---</span>';
      var r = String(rating).toLowerCase().trim();
      if (['high','red'].includes(r)) return '<span class="chiefs-pill chiefs-pill-red">High</span>';
      if (['medium','yellow'].includes(r)) return '<span class="chiefs-pill chiefs-pill-gold">Medium</span>';
      if (['low','green'].includes(r)) return '<span class="chiefs-pill chiefs-pill-green">Low</span>';
      return '<span class="chiefs-pill chiefs-pill-gray">' + rating + '</span>';
    }

    function chiefsTrendArrow(trend) {
      if (!trend) return '';
      var t = String(trend).toLowerCase().trim();
      if (['up','worsening'].includes(t)) return '<span style="color:#E31837">▲</span>';
      if (['down','improving'].includes(t)) return '<span style="color:var(--teal,#184655)">▼</span>';
      if (['flat','steady','stable'].includes(t)) return '<span style="color:var(--muted)">→</span>';
      return trend;
    }

    function chiefsSectionError(label, sheetKey) {
      return '<div class="chiefs-empty">Could not load ' + label
        + ' <button class="chiefs-retry-btn" onclick="chiefsRetrySheet(\'' + sheetKey + '\')">Retry</button></div>';
    }

    function chiefsSourceLink(sheetKey) {
      var url = CHIEFS_SHEET_URLS[sheetKey];
      return url ? '<a class="chiefs-source-link" href="' + url + '" target="_blank" rel="noopener" title="Open in Smartsheet">&#x1F517;</a>' : '';
    }

    function chiefsStaleTag(sheetKey) {
      var meta = _chiefsSheetMeta[sheetKey];
      if (!meta || !meta.updatedAt) return '';
      var dt = new Date(meta.updatedAt);
      var days = (Date.now() - dt.getTime()) / 86400000;
      if (days > 14) return '<span class="chiefs-stale-badge">&#x23F0; Updated ' + chiefsFmtDate(meta.updatedAt) + '</span>';
      return '';
    }

    function chiefsFetchSheet(sheetKey) {
      return fetch('/api/chiefs?sheet=' + sheetKey)
        .then(function(r) { if (!r.ok) throw new Error(sheetKey + ': ' + r.status); return r.json(); })
        .then(function(d) {
          _chiefsData[sheetKey] = d.rows || [];
          _chiefsSheetMeta[sheetKey] = { updatedAt: d.updatedAt || null, name: d.name || '' };
          delete _chiefsSectionErrors[sheetKey];
          return d.rows || [];
        })
        .catch(function(e) {
          _chiefsSectionErrors[sheetKey] = e.message;
          _chiefsData[sheetKey] = [];
          return [];
        });
    }

    function chiefsRetrySheet(sheetKey) {
      var el = document.getElementById('chiefs-dashboard');
      if (!el) return;
      chiefsFetchSheet(sheetKey).then(function() { buildChiefsDashboard(el); });
    }

    function chiefsSortRows(rows, colKey, dir) {
      if (!rows || !rows.length) return rows;
      return rows.slice().sort(function(a, b) {
        var va = a[colKey], vb = b[colKey];
        if (va == null) va = ''; if (vb == null) vb = '';
        var na = parseFloat(String(va).replace(/[$,]/g,''));
        var nb = parseFloat(String(vb).replace(/[$,]/g,''));
        if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
        var da = new Date(va), db = new Date(vb);
        if (!isNaN(da) && !isNaN(db)) return dir === 'asc' ? da - db : db - da;
        va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        return dir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
      });
    }

    function chiefsBuildTable(sheetKey, columns, opts) {
      opts = opts || {};
      var rows = _chiefsData[sheetKey] || [];
      var err = _chiefsSectionErrors[sheetKey];
      var sectionKey = sheetKey + '-' + (columns[0] ? columns[0].key : 'col');
      var state = _chiefsSortState[sectionKey];

      if (err) return chiefsSectionError(opts.label || 'section', sheetKey);
      if (!rows || !rows.length) return '<div class="chiefs-empty">' + (opts.emptyText || 'No items') + '</div>';

      if (state && state.col) {
        rows = chiefsSortRows(rows, state.col, state.dir);
      } else if (opts.defaultSortCol) {
        rows = chiefsSortRows(rows, opts.defaultSortCol, opts.defaultSortDir || 'asc');
      }

      var cap = opts.cap || 0;
      var total = rows.length;
      if (cap > 0 && rows.length > cap) rows = rows.slice(0, cap);

      var h = '<div class="chiefs-table-wrap"><table class="chiefs-table"><thead><tr>';
      columns.forEach(function(c) {
        var asc = state && state.col === c.key && state.dir === 'asc';
        var desc = state && state.col === c.key && state.dir === 'desc';
        h += '<th onclick="chiefsSortTable(\'' + sectionKey + '\',\'' + c.key + '\')">' + c.label
          + (asc ? ' ▲' : desc ? ' ▼' : '') + '</th>';
      });
      h += '</tr></thead><tbody>';

      rows.forEach(function(row) {
        var isComplete = String(row.Status || '').toLowerCase().trim() === 'complete';
        h += '<tr' + (isComplete ? ' class="completed-row"' : '') + '>';
        columns.forEach(function(c) {
          var val = row[c.key];
          var cellHTML = '';
          if (c.fmt === 'currency') cellHTML = chiefsFmtCurrency(val);
          else if (c.fmt === 'date') cellHTML = chiefsFmtDate(val);
          else if (c.fmt === 'status') cellHTML = chiefsStatusPill(val);
          else if (c.fmt === 'rating') cellHTML = chiefsRatingPill(val);
          else if (c.fmt === 'trend') cellHTML = chiefsTrendArrow(val) + ' ' + (val || '');
          else cellHTML = val || '-';
          var overdue = (c.fmt === 'date' && val && !isComplete && new Date(val) < new Date() && !isNaN(new Date(val)));
          h += '<td' + (overdue ? ' class="chiefs-cell-overdue"' : c.key === columns[0].key ? ' class="chiefs-cell-primary"' : '') + '>' + cellHTML + '</td>';
        });
        h += '</tr>';
      });

      if (cap > 0 && total > cap) {
        h += '<tr><td colspan="' + columns.length + '" style="text-align:center;padding:6px;font-size:11px;color:var(--muted)">Showing ' + cap + ' of ' + total + ' items</td></tr>';
      }
      return h + '</tbody></table></div>';
    }

    function chiefsSortTable(sectionKey, colKey) {
      var state = _chiefsSortState[sectionKey] || { col: colKey, dir: 'asc' };
      if (state.col === colKey) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.col = colKey; state.dir = 'asc'; }
      _chiefsSortState[sectionKey] = state;
      var el = document.getElementById('chiefs-dashboard');
      if (el) buildChiefsDashboard(el);
    }

    // ── MAIN RENDER ───────────────────────────────────────────

    function renderChiefsDashboard() {
      var el = document.getElementById('chiefs-dashboard');
      if (!el) return;
      el.innerHTML = '<div class="chiefs-skeleton"><div class="chiefs-loader"></div>Loading Command Center...</div>';
      var sheets = ['01','02','03','04','05','06','07','08','09','10','11','12','13'];
      Promise.allSettled(sheets.map(function(s) { return chiefsFetchSheet(s); })).then(function() {
        buildChiefsDashboard(el);
        chiefsStartRefresh();
      });
    }

    function buildChiefsDashboard(el) {
      var d = _chiefsData;
      var hasAuthErr = Object.values(_chiefsSectionErrors).some(function(e) { return String(e).indexOf('401') >= 0 || String(e).indexOf('403') >= 0; });
      var now = new Date();
      var html = '';

      if (hasAuthErr) html += '<div class="chiefs-auth-banner">Smartsheet connection needs re-authorization</div>';

      // Live badge + refresh
      html += '<div class="chiefs-live-badge" id="chiefs-live-badge">';
      html += '<span class="chiefs-refresh-dot" id="chiefs-refresh-dot"></span> Updated '
        + now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
      html += ' <button class="chiefs-refresh-btn" onclick="chiefsManualRefresh()">&#x21bb; Refresh</button>';
      html += '</div>';

      // Row 1: Header + anchor
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-header-band">';
      html += '<div class="chiefs-header-title">KC CHIEFS TRAINING FACILITY ' + chiefsSourceLink('02') + '</div>';
      html += '<div class="chiefs-header-sub">Project Command Center &middot; Turner & Townsend + Level Up &middot; Olathe, Kansas</div>';
      html += '<div class="chiefs-header-desc">A single source of truth that keeps priorities visible, decisions organized, and Chiefs leadership informed.</div>';
      html += '</div>';
      html += '<div class="chiefs-anchor"><div class="chiefs-anchor-label">SUBSTANTIAL COMPLETION</div><div class="chiefs-anchor-value">Q4 2030</div></div>';
      html += '</div>';

      // Row 2: KPI strip (sheet 06)
      var kpiRows = d['06'] || [];
      html += '<div class="chiefs-row chiefs-kpi-row">';
      ['Total Budget','Committed','Billed to Date','Percent Spent','Contingency','Schedule Status'].forEach(function(kpiName) {
        var row = null;
        kpiRows.forEach(function(r) { if (r.KPI === kpiName) row = r; });
        var val = row ? row.Value : '-';
        var display = (kpiName === 'Percent Spent') ? val : chiefsFmtCurrency(val);
        var cls = '';
        if (kpiName === 'Contingency') cls = 'gold';
        else if (kpiName === 'Schedule Status' && val) {
          var sv = String(val).toLowerCase();
          cls = sv === 'on track' ? 'green' : sv === 'at risk' ? 'gold' : '';
        }
        var bar = '';
        if (kpiName === 'Percent Spent' && val) {
          var p = parseFloat(String(val).replace(/%/g,''));
          if (!isNaN(p)) bar = '<div class="chiefs-kpi-progress"><div class="chiefs-kpi-progress-fill" style="width:' + Math.min(p,100) + '%"></div></div>';
        }
        html += '<div class="chiefs-kpi"><div class="chiefs-kpi-label">' + kpiName.toUpperCase() + '</div><div class="chiefs-kpi-val ' + cls + '">' + display + '</div>' + bar + '</div>';
      });
      html += '</div>';

      // Row 3: Scorecard + Budget chart
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Project Health Scorecard ' + chiefsSourceLink('13') + chiefsStaleTag('13') + '</div>';
      var healthRows = d['13'] || [];
      if (healthRows.length) {
        html += '<div class="chiefs-scorecard">';
        healthRows.forEach(function(r) {
          var st = String(r.Status || '').toLowerCase().trim();
          var dc = st === 'green' ? 'chiefs-dot-green' : st === 'yellow' ? 'chiefs-dot-yellow' : 'chiefs-dot-red';
          html += '<div class="chiefs-score-item" title="' + (r.Note || '').replace(/"/g,'') + '"><span class="chiefs-dot ' + dc + '"></span><span>' + (r.Category || '') + '</span></div>';
        });
        html += '</div>';
      } else { html += '<div class="chiefs-empty">No health data</div>'; }
      html += '</div>';

      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Budget by Category ($M) ' + chiefsSourceLink('01') + chiefsStaleTag('01') + '</div>';
      html += (d['01'] && d['01'].length) ? '<div class="chiefs-chart-wrap"><canvas id="chiefs-chart-budget"></canvas></div>' : '<div class="chiefs-empty">No budget data</div>';
      html += '</div></div>';

      // Row 4: Cash Flow + Milestones
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Cash Flow Curve (Cumulative $M) ' + chiefsSourceLink('05') + chiefsStaleTag('05') + '</div>';
      var cfRows = d['05'] || [];
      html += (cfRows.length > 1) ? '<div class="chiefs-chart-wrap"><canvas id="chiefs-chart-cashflow"></canvas></div>' : '<div class="chiefs-empty">' + (cfRows.length ? 'Not enough data to chart' : 'No cash flow data') + '</div>';
      html += '</div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Milestone Schedule ' + chiefsSourceLink('02') + chiefsStaleTag('02') + '</div>';
      html += chiefsBuildTable('02', [{key:'Milestone',label:'Milestone'},{key:'Target Date',label:'Target',fmt:'date'},{key:'Variance',label:'Variance'},{key:'Status',label:'Status',fmt:'status'}], { defaultSortCol:'Target Date' });
      html += '</div></div>';

      // Row 5: Action Items + Procurement
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Action Items ' + chiefsSourceLink('03') + chiefsStaleTag('03') + '</div>';
      html += chiefsBuildTable('03', [{key:'Item',label:'Item'},{key:'Owner',label:'Owner'},{key:'Due Date',label:'Due',fmt:'date'},{key:'Priority',label:'Priority',fmt:'rating'}], { cap:10, defaultSortCol:'Due Date' });
      html += '</div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Procurement & Long-Lead ' + chiefsSourceLink('07') + chiefsStaleTag('07') + '</div>';
      html += chiefsBuildTable('07', [{key:'Package',label:'Package'},{key:'Budget Value',label:'Budget',fmt:'currency'},{key:'Need-By',label:'Need-By',fmt:'date'},{key:'Status',label:'Status',fmt:'status'}], { defaultSortCol:'Need-By' });
      html += '</div></div>';

      // Row 6: Decisions + Next 90
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Upcoming Key Decisions ' + chiefsSourceLink('08') + chiefsStaleTag('08') + '</div>';
      html += chiefsBuildTable('08', [{key:'Decision',label:'Decision'},{key:'Needed By',label:'Needed By',fmt:'date'},{key:'Status',label:'Status',fmt:'status'}], { defaultSortCol:'Needed By' });
      html += '</div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Next 90 Days ' + chiefsSourceLink('09') + chiefsStaleTag('09') + '</div>';
      html += chiefsBuildTable('09', [{key:'Activity',label:'Activity'},{key:'Start',label:'Start',fmt:'date'},{key:'Finish',label:'Finish',fmt:'date'},{key:'Owner',label:'Owner'}], { defaultSortCol:'Start' });
      html += '</div></div>';

      // Row 7: Risks + Budget Position
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w3"><div class="chiefs-widget-title">Top Risks & Mitigation ' + chiefsSourceLink('10') + chiefsStaleTag('10') + '</div>';
      html += chiefsBuildTable('10', [{key:'Risk',label:'Risk'},{key:'Rating',label:'Rating',fmt:'rating'},{key:'Trend',label:'Trend',fmt:'trend'},{key:'Mitigation',label:'Mitigation'}], { defaultSortCol:'Rating', defaultSortDir:'desc' });
      html += '</div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Budget Position ' + chiefsSourceLink('12') + chiefsStaleTag('12') + '</div>';
      html += '<div class="chiefs-chart-wrap"><canvas id="chiefs-chart-budgetpos"></canvas></div><div class="chiefs-bp-metrics" id="chiefs-bp-metrics"></div>';
      html += '</div></div>';

      // Row 8: Team + Snapshot
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Project Team ' + chiefsSourceLink('11') + chiefsStaleTag('11') + '</div>';
      html += chiefsBuildTable('11', [{key:'Name',label:'Name'},{key:'Role',label:'Role'},{key:'Firm',label:'Firm'}], {});
      html += '</div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Project Snapshot ' + chiefsSourceLink('04') + chiefsStaleTag('04') + '</div>';
      var snapRows = d['04'] || [];
      if (snapRows.length) {
        html += '<table class="chiefs-table"><tbody>';
        snapRows.forEach(function(r) { html += '<tr><td class="chiefs-cell-primary" style="width:40%">' + (r.Metric || '') + '</td><td>' + (r.Value || '') + '</td></tr>'; });
        html += '</tbody></table>';
      } else { html += '<div class="chiefs-empty">No snapshot data</div>'; }
      html += '</div></div>';

      // Row 9: Docs + Camera
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Document Shortcuts</div><div class="chiefs-doc-links">';
      CHIEFS_DOCS.forEach(function(doc) {
        html += doc.url
          ? '<a class="chiefs-doc-link" href="' + doc.url + '" target="_blank" rel="noopener">' + doc.label + '</a>'
          : '<span class="chiefs-doc-link disabled">' + doc.label + '</span>';
      });
      html += '</div></div>';
      html += '<div class="chiefs-widget chiefs-w1"><div class="chiefs-widget-title">Live Jobsite Camera</div><div class="chiefs-camera-ph"><div class="chiefs-camera-icon">&#x1F4F7;</div><div>Coming online with site mobilization</div></div></div>';
      html += '</div>';

      el.innerHTML = html;
      renderChiefsCharts();
      chiefsRenderBPMetrics();
    }

    // ── Charts ────────────────────────────────────────────────

    function renderChiefsCharts() {
      if (typeof Chart === 'undefined') return;
      var root = document.documentElement;
      var cs = getComputedStyle(root);
      var txt = cs.getPropertyValue('--charcoal').trim() || '#181818';
      var border = cs.getPropertyValue('--border').trim() || '#E2E2DE';
      var teal = cs.getPropertyValue('--teal').trim() || '#184655';
      var red = '#E31837', gold = '#FFB81C', slate = '#8A8AA3';
      Chart.defaults.color = txt.cloneNode;
      Chart.defaults.borderColor = 'rgba(138,138,163,0.15)';
      var grid = 'rgba(138,138,163,0.15)';

      // Budget bar (sheet 01)
      var bd = _chiefsData['01'];
      if (bd && bd.length && document.getElementById('chiefs-chart-budget')) {
        var lb = [], am = [];
        bd.forEach(function(r) { lb.push(r.Category || ''); am.push(r['Planned Amount'] ? Math.round(r['Planned Amount'] / 1000000) : 0); });
        new Chart(document.getElementById('chiefs-chart-budget'), {
          type: 'bar',
          data: { labels: lb, datasets: [{ label: 'Planned ($M)', data: am, backgroundColor: teal, borderRadius: 3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: txt, maxRotation: 45, font: { size: 10 } } }, y: { ticks: { color: txt } } } }
        });
      }

      // Cash flow (sheet 05)
      var cd = _chiefsData['05'];
      if (cd && cd.length > 1 && document.getElementById('chiefs-chart-cashflow')) {
        var ql = [], pl = [], ac = [];
        cd.forEach(function(r) { ql.push(r.Quarter || ''); pl.push(r['Planned Cumulative'] || 0); ac.push(r['Actual Cumulative'] != null ? r['Actual Cumulative'] : null); });
        new Chart(document.getElementById('chiefs-chart-cashflow'), {
          type: 'line',
          data: { labels: ql, datasets: [
            { label: 'Planned', data: pl, borderColor: slate, borderDash: [5,5], fill: false, pointRadius: 0, tension: 0.3 },
            { label: 'Actual', data: ac, borderColor: teal, backgroundColor: teal + '18', fill: '-1', pointRadius: 3, tension: 0.3, spanGaps: false }
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: txt, boxWidth: 12 } } }, scales: { x: { ticks: { color: txt, font: { size: 9 } } }, y: { ticks: { color: txt } } } }
        });
      }

      // Budget position (sheet 12)
      if (_chiefsData['12'] && document.getElementById('chiefs-chart-budgetpos')) {
        var bpd = _chiefsData['12'];
        var f = function(l) { for (var i=0; i<bpd.length; i++) { if (bpd[i].Measure && bpd[i].Measure.indexOf(l) >= 0) return Math.round((bpd[i].Amount||0)/1000000); } return 0; };
        new Chart(document.getElementById('chiefs-chart-budgetpos'), {
          type: 'bar',
          data: { labels: ['Budget Position'], datasets: [
            { label: 'Paid', data: [f('Paid')], backgroundColor: teal, borderRadius: 2 },
            { label: 'Retainage', data: [f('Retainage')], backgroundColor: gold, borderRadius: 2 },
            { label: 'Remaining', data: [f('Remaining')], backgroundColor: border, borderRadius: 2 }
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: txt, boxWidth: 12 } } }, scales: { x: { display: false }, y: { stacked: true, ticks: { color: txt } } }, indexAxis: 'y' }
        });
      }
    }

    function chiefsRenderBPMetrics() {
      var el = document.getElementById('chiefs-bp-metrics');
      if (!el) return;
      var bpd = _chiefsData['12'] || [];
      var fv = function(l) { for (var i=0; i<bpd.length; i++) { if (bpd[i].Measure && bpd[i].Measure.indexOf(l) >= 0) return chiefsFmtCurrency(bpd[i].Amount); } return '-'; };
      el.innerHTML = '<div class="chiefs-bp-metric"><div class="chiefs-kpi-label">PAID TO DATE</div><div class="chiefs-kpi-val">' + fv('Paid') + '</div></div>'
        + '<div class="chiefs-bp-metric"><div class="chiefs-kpi-label">RETAINAGE HELD</div><div class="chiefs-kpi-val gold">' + fv('Retainage') + '</div></div>'
        + '<div class="chiefs-bp-metric"><div class="chiefs-kpi-label">REMAINING</div><div class="chiefs-kpi-val">' + fv('Remaining') + '</div></div>';
    }

    // ── Refresh ───────────────────────────────────────────────

    function chiefsStartRefresh() {
      chiefsStopRefresh();
      _chiefsRefreshTimer = setInterval(function() {
        if (document.visibilityState === 'visible') chiefsRefreshAll();
      }, 600000);
      document.addEventListener('visibilitychange', function chiefsVisHandler() {
        if (document.visibilityState === 'visible' && Date.now() - _chiefsLastRefresh > 600000) chiefsRefreshAll();
      });
    }

    function chiefsStopRefresh() {
      if (_chiefsRefreshTimer) { clearInterval(_chiefsRefreshTimer); _chiefsRefreshTimer = null; }
    }

    function chiefsManualRefresh() {
      var btn = document.querySelector('.chiefs-refresh-btn');
      if (btn) btn.disabled = true;
      chiefsRefreshAll().then(function() { if (btn) btn.disabled = false; });
    }

    function chiefsRefreshAll() {
      var sheets = ['01','02','03','04','05','06','07','08','09','10','11','12','13'];
      return Promise.allSettled(sheets.map(function(s) { return chiefsFetchSheet(s); })).then(function() {
        _chiefsLastRefresh = Date.now();
        var el = document.getElementById('chiefs-dashboard');
        if (el) buildChiefsDashboard(el);
      });
    }

    // ── Theme change observer ─────────────────────────────────

    (function() {
      var ticking = false;
      var observer = new MutationObserver(function() {
        if (!ticking) { ticking = true;
          setTimeout(function() { ticking = false; renderChiefsCharts(); }, 200); }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    })();