// lib/handlers/dova-dashboard.js — DOVA Arena V3 Dashboard
// ES module serving full inline HTML with Chart.js CDN only
// Fetches all 8 DOVA sheets directly via imported helpers

import { fetchSheet, DOVA_SHEETS } from './dova.js';

const SHEET_ORDER = ['00', '01', '02', '03', '04', '05', '06', '08'];

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHTML(data) {
  const now = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // Compute KPIs
  let totalBudget = 0;
  let permitsApproved = 0;
  let permitsInProgress = 0;
  let permitsNotStarted = 0;

  if (data['04'] && data['04'].rows) {
    data['04'].rows.forEach(r => {
      const val = parseFloat(r['Amount']) || parseFloat(r['Value']) || parseFloat(r['Budget']) || 0;
      totalBudget += val;
    });
  }

  if (data['08'] && data['08'].rows) {
    data['08'].rows.forEach(r => {
      const status = (r['Status'] || r['Permit Status'] || r['Permitting Status'] || '').toString().toUpperCase();
      if (status === 'APPROVED' || status === 'COMPLETE' || status === 'COMPLETED') {
        permitsApproved++;
      } else if (status === 'IN PROGRESS' || status === 'IN-PROGRESS' || status === 'INPROGRESS' || status === 'SUBMITTED' || status === 'REVIEW') {
        permitsInProgress++;
      } else if (status === '' || status === 'NOT STARTED' || status === 'NOTSTARTED' || status === 'PENDING' || status === 'N/A' || status === 'NULL' || status === null || status === undefined) {
        permitsNotStarted++;
      }
    });
  }

  const budgetDisplay = totalBudget >= 1000000
    ? `$${(totalBudget / 1000000).toFixed(2)}M`
    : totalBudget >= 1000
      ? `$${(totalBudget / 1000).toFixed(1)}K`
      : `$${totalBudget.toFixed(0)}`;

  // Build sheet sections
  let sectionsHTML = '';
  SHEET_ORDER.forEach((key, idx) => {
    const sheet = data[key];
    if (!sheet || sheet.error) {
      sectionsHTML += `
        <div class="section">
          <div class="section-header" onclick="toggleSection(this)">
            <span class="section-num">${escHtml(key)}</span>
            <span class="section-title">${escHtml(DOVA_SHEETS[key]?.name || key)}</span>
            <span class="section-badge error">Error: ${escHtml(sheet?.error || 'No data')}</span>
            <span class="section-arrow">▶</span>
          </div>
        </div>`;
      return;
    }

    const { name, columns, rows, updatedAt } = sheet;
    const rowCount = rows ? rows.length : 0;
    const lastUpdated = updatedAt ? new Date(updatedAt).toLocaleString() : 'N/A';

    let tableHeader = '';
    let tableRows = '';
    const isPermitting = key === '08';
    let statusColIdx = -1;

    if (columns && columns.length > 0) {
      tableHeader = columns.map(c => `<th>${escHtml(c)}</th>`).join('');

      if (isPermitting) {
        statusColIdx = columns.findIndex(c => /status/i.test(c));
      }

      const displayRows = rows.slice(0, 100);
      displayRows.forEach(row => {
        const cells = columns.map(col => {
          const val = row[col];
          const display = val !== null && val !== undefined ? String(val) : '';
          return `<td>${escHtml(display)}</td>`;
        }).join('');

        let rowClass = '';
        if (isPermitting && statusColIdx >= 0) {
          const statusVal = (row[columns[statusColIdx]] || '').toString().toUpperCase();
          if (statusVal === 'APPROVED' || statusVal === 'COMPLETE' || statusVal === 'COMPLETED') {
            rowClass = ' status-approved';
          } else if (statusVal === 'IN PROGRESS' || statusVal === 'IN-PROGRESS' || statusVal === 'SUBMITTED' || statusVal === 'REVIEW' || statusVal === 'INPROGRESS') {
            rowClass = ' status-in-progress';
          } else if (statusVal === '' || statusVal === 'NOT STARTED' || statusVal === 'PENDING' || statusVal === 'N/A' || statusVal === 'NULL') {
            rowClass = ' status-not-started';
          }
        }

        tableRows += `<tr class="${rowClass}">${cells}</tr>`;
      });
    }

    const colspan = columns ? columns.length : 1;
    sectionsHTML += `
      <div class="section">
        <div class="section-header${idx === 0 ? ' expanded' : ''}" onclick="toggleSection(this)">
          <span class="section-num">${escHtml(key)}</span>
          <span class="section-title">${escHtml(name)}</span>
          <span class="section-meta">${rowCount} rows · Updated: ${escHtml(lastUpdated)}</span>
          <span class="section-arrow">▶</span>
        </div>
        <div class="section-body"${idx === 0 ? '' : ' style="display:none"'}>
          ${columns && columns.length > 0 ? `
          <div class="table-wrap">
            <table>
              <thead><tr>${tableHeader}</tr></thead>
              <tbody>${tableRows || '<tr><td colspan="' + colspan + '" class="empty">No rows</td></tr>'}</tbody>
            </table>
          </div>
          ` : '<div class="empty">No columns</div>'}
          ${rows && rows.length > 100 ? `<div class="table-more">Showing 100 of ${rows.length} rows</div>` : ''}
        </div>
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>02 - DOVA Arena</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#FFFFFF;color:#1E293B;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5;min-height:100vh}

/* Masthead */
.masthead{background:#FFFFFF;border-bottom:3px solid #C4962B;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06);position:sticky;top:0;z-index:100}
.masthead-left{display:flex;align-items:center;gap:14px}
.masthead-logo{width:42px;height:42px;background:#1F4E79;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#C4962B;font-weight:800;font-size:16px;letter-spacing:2px;flex-shrink:0}
.masthead-title{font-size:22px;font-weight:800;color:#1F4E79;letter-spacing:-0.5px}
.masthead-sub{display:block;font-size:11px;font-weight:600;color:#C4962B;letter-spacing:1px;margin-top:-2px;text-transform:uppercase}
.masthead-right{display:flex;align-items:center;gap:12px;font-size:12px;color:#64748B;flex-wrap:wrap}
.live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#16A34A;animation:pulse 2s infinite;margin-right:5px;vertical-align:middle}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.refresh-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;background:#1F4E79;color:#fff;border:none;cursor:pointer;font-family:inherit;transition:all .2s}
.refresh-btn:hover{background:#2A5A88}
.refresh-btn:disabled{opacity:.6;cursor:wait}

/* KPI Ticker */
.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;padding:18px 28px;background:#F8FAFC;border-bottom:1px solid #E2E8F0}
.kpi-card{background:#FFFFFF;border-radius:10px;padding:14px 18px;border:1px solid #E2E8F0;box-shadow:0 1px 2px rgba(0,0,0,0.04)}
.kpi-label{font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.kpi-value{font-size:24px;font-weight:800;color:#1F4E79}
.kpi-value.gold{color:#C4962B}
.kpi-value.green{color:#16A34A}
.kpi-value.orange{color:#EA580C}

/* Layout */
.wrap{max-width:1400px;margin:0 auto;padding:18px 24px}

/* Section Cards */
.section{background:#FFFFFF;border-radius:10px;border:1px solid #E2E8F0;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
.section-header{display:flex;align-items:center;gap:12px;padding:13px 18px;cursor:pointer;user-select:none;transition:background .15s}
.section-header:hover{background:#F8FAFC}
.section-num{display:inline-flex;width:32px;height:32px;border-radius:8px;background:#1F4E79;color:#fff;font-weight:700;font-size:13px;align-items:center;justify-content:center;flex-shrink:0}
.section-title{font-weight:600;font-size:15px;color:#1E293B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.section-meta{font-size:11px;color:#94A3B8;white-space:nowrap;flex-shrink:0}
.section-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:#FEF2F2;color:#DC2626;flex-shrink:0}
.arrow{font-size:12px;color:#94A3B8;transition:transform .2s;flex-shrink:0}
.section-header.expanded .arrow{transform:rotate(90deg)}
.section-body{padding:0;border-top:1px solid #E2E8F0}

/* Tables */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
thead{background:#1F4E79;color:#fff}
thead th{padding:10px 14px;text-align:left;font-weight:600;font-size:12px;letter-spacing:0.3px;white-space:nowrap;border-bottom:2px solid #C4962B}
tbody td{padding:9px 14px;border-bottom:1px solid #F1F5F9;white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis}
tbody tr:hover{background:#F8FAFC}
tbody tr:last-child td{border-bottom:none}
tbody tr.status-approved{background:#F0FDF4}
tbody tr.status-approved:hover{background:#DCFCE7}
tbody tr.status-in-progress{background:#FEFCE8}
tbody tr.status-in-progress:hover{background:#FEF9C3}
tbody tr.status-not-started{background:#FFF7ED}
tbody tr.status-not-started:hover{background:#FFEDD5}
.empty{text-align:center;padding:24px;color:#94A3B8;font-size:14px}
.table-more{text-align:center;padding:10px;font-size:11px;color:#94A3B8;background:#FAFBFC;border-top:1px solid #F1F5F9;font-weight:500}

/* Footer */
.footer{text-align:center;padding:20px;font-size:11px;color:#94A3B8;border-top:1px solid #E2E8F0;margin-top:10px}
</style>
</head>
<body>
<div class="masthead">
  <div class="masthead-left">
    <div class="masthead-logo">DA</div>
    <div>
      <div class="masthead-title">02 — DOVA Arena</div>
      <span class="masthead-sub">Level Up Playbook · Command Center</span>
    </div>
  </div>
  <div class="masthead-right">
    <span><span class="live-dot"></span><span id="lastUpdate">${escHtml(now)}</span></span>
    <button class="refresh-btn" onclick="refreshData()" id="refreshBtn">⟳ Refresh</button>
  </div>
</div>

<div class="kpi-row">
  <div class="kpi-card">
    <div class="kpi-label">Total Budget</div>
    <div class="kpi-value gold" id="kpiBudget">${escHtml(budgetDisplay)}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Permits Approved</div>
    <div class="kpi-value green" id="kpiApproved">${permitsApproved}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Permits In Progress</div>
    <div class="kpi-value orange" id="kpiInProgress">${permitsInProgress}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Permits Not Started</div>
    <div class="kpi-value" id="kpiNotStarted">${permitsNotStarted}</div>
  </div>
</div>

<div class="wrap" id="dashboardWrap">
  ${sectionsHTML}
</div>

<div class="footer">
  DOVA Arena · Level Up Playbook · Auto-refreshes every 60s
</div>

<script>
function toggleSection(el) {
  el.classList.toggle('expanded');
  const body = el.nextElementSibling;
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
}

async function refreshData() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = '⟳ Loading...';

  try {
    const resp = await fetch('/api/dova');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    // Update timestamp
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString('en-US', {
      month:'short', day:'numeric', year:'numeric',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });

    // Recompute KPIs
    let totalBudget = 0;
    let permitsApproved = 0;
    let permitsInProgress = 0;
    let permitsNotStarted = 0;

    if (data['04'] && data['04'].rows) {
      data['04'].rows.forEach(r => {
        const val = parseFloat(r['Amount']) || parseFloat(r['Value']) || parseFloat(r['Budget']) || 0;
        totalBudget += val;
      });
    }
    if (data['08'] && data['08'].rows) {
      data['08'].rows.forEach(r => {
        const status = (r['Status'] || r['Permit Status'] || r['Permitting Status'] || '').toString().toUpperCase();
        if (status === 'APPROVED' || status === 'COMPLETE' || status === 'COMPLETED') {
          permitsApproved++;
        } else if (status === 'IN PROGRESS' || status === 'IN-PROGRESS' || status === 'SUBMITTED' || status === 'REVIEW') {
          permitsInProgress++;
        } else if (status === '' || status === 'NOT STARTED' || status === 'PENDING' || status === 'N/A') {
          permitsNotStarted++;
        }
      });
    }

    const budgetDisplay = totalBudget >= 1000000
      ? '$' + (totalBudget / 1000000).toFixed(2) + 'M'
      : totalBudget >= 1000
        ? '$' + (totalBudget / 1000).toFixed(1) + 'K'
        : '$' + totalBudget.toFixed(0);

    document.getElementById('kpiBudget').textContent = budgetDisplay;
    document.getElementById('kpiApproved').textContent = permitsApproved;
    document.getElementById('kpiInProgress').textContent = permitsInProgress;
    document.getElementById('kpiNotStarted').textContent = permitsNotStarted;

  } catch (err) {
    console.error('Refresh error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = '⟳ Refresh';
  }
}

setInterval(refreshData, 60000);
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Fetch all 8 sheets in parallel
    const keys = Object.keys(DOVA_SHEETS);
    const results = {};
    const promises = keys.map(async (key) => {
      try {
        results[key] = await fetchSheet(key);
      } catch (e) {
        console.error(`DOVA dashboard fetch error for ${key}:`, e.message);
        results[key] = { sheet: key, name: DOVA_SHEETS[key].name, error: e.message, columns: [], rows: [] };
      }
    });
    await Promise.all(promises);

    const html = buildHTML(results);
    res.status(200).send(html);
  } catch (e) {
    console.error('DOVA Dashboard handler error:', e.message);
    // Render with empty data rather than error page
    const emptyData = {};
    Object.keys(DOVA_SHEETS).forEach(key => {
      emptyData[key] = { sheet: key, name: DOVA_SHEETS[key].name, columns: [], rows: [] };
    });
    res.status(200).send(buildHTML(emptyData));
  }
}