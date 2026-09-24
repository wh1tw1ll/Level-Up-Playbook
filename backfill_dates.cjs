const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('C:\\Users\\HermesAdmin\\Level-Up-Playbook\\.env.local', 'utf8');
const tokenLine = env.split('\n').find(l => l.startsWith('SMARTSHEET_TOKEN'));
const TOKEN = tokenLine.split('=')[1].trim().replace(/"/g, '');

const DOVA = '4456864287772548';
const PERSONAL = '2802755367554948';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.smartsheet.com',
      path: '/2.0' + path,
      method,
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inferDueDate(task) {
  // 1. Try to extract date from sourceRef meeting name
  const src = (task.sourceRef || '').toLowerCase();
  const dateMatch = src.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];

  // 2. Check actionItem for urgency hints
  const text = (task.actionItem || '').toLowerCase();
  if (/\burgen|asap|today\b/.test(text)) return addDays(today(), 1);
  if (/\btomorrow\b/.test(text)) return addDays(today(), 1);
  if (/\bthis week|by friday|by fri\b/.test(text)) {
    const now = new Date();
    const day = now.getDay();
    const daysToFri = day <= 5 ? 5 - day : 6; // Fri is day 5
    return addDays(today(), daysToFri || 1);
  }
  if (/\bnext week\b/.test(text)) return addDays(today(), 7);
  if (/\bnext month|by end of month\b/.test(text)) return addDays(today(), 30);
  if (/\bsoon\b/.test(text)) return addDays(today(), 3);
  if (/\bcouple days|few days\b/.test(text)) return addDays(today(), 3);
  if (/\bnext meeting|next touch|next week\b/.test(src)) return addDays(today(), 7);

  // 3. Default: 7 days
  return addDays(today(), 7);
}

async function processSheet(sheetId, label) {
  console.log('\n=== ' + label + ' ===');
  const sheet = await api('GET', '/sheets/' + sheetId + '?include=columns&level=2');
  
  const cols = {};
  for (const c of (sheet.columns || [])) cols[c.title] = c;
  
  const ddCol = cols['Due Date'];
  const cdCol = cols['Completed Date'];
  const aCol = cols['Action ID'];
  const sCol = cols['Status'];
  const srcRefCol = cols['SourceRef'];
  
  if (!ddCol || !cdCol) {
    console.log('  Missing columns:', !ddCol ? 'Due Date' : '', !cdCol ? 'Completed Date' : '');
    return;
  }

  const rows = sheet.rows || [];
  console.log('  Total rows:', rows.length);

  const ddUpdates = [];
  const cdUpdates = [];

  for (const row of rows) {
    const cells = {};
    for (const c of (row.cells || [])) {
      const title = Object.keys(cols).find(k => cols[k].id === c.columnId);
      if (title) cells[title] = c.value ?? c.displayValue ?? '';
    }

    // Build a task-like object for inference
    const task = {
      actionItem: cells['Action ID'] || '',
      sourceRef: cells['SourceRef'] || '',
      status: cells['Status'] || '',
    };

    // Due Date: set if missing
    const currentDD = cells['Due Date'];
    if (!currentDD) {
      const inferred = inferDueDate(task);
      ddUpdates.push({ id: row.id, cells: [{ columnId: ddCol.id, value: inferred }] });
    }

    // Completed Date: set if Complete
    if (task.status === 'Complete' && !cells['Completed Date']) {
      cdUpdates.push({ id: row.id, cells: [{ columnId: cdCol.id, value: today() }] });
    }
  }

  console.log('  Due Date backfills:', ddUpdates.length);
  console.log('  Completed Date backfills:', cdUpdates.length);

  // Batch updates (max 100 per call per Smartsheet limits)
  const BATCH = 100;
  
  if (ddUpdates.length > 0) {
    for (let i = 0; i < ddUpdates.length; i += BATCH) {
      const batch = ddUpdates.slice(i, i + BATCH);
      await api('PUT', '/sheets/' + sheetId + '/rows', batch);
      console.log('  Wrote DD batch ' + (i/BATCH + 1) + '/' + Math.ceil(ddUpdates.length/BATCH));
    }
  }
  
  if (cdUpdates.length > 0) {
    for (let i = 0; i < cdUpdates.length; i += BATCH) {
      const batch = cdUpdates.slice(i, i + BATCH);
      await api('PUT', '/sheets/' + sheetId + '/rows', batch);
      console.log('  Wrote CD batch ' + (i/BATCH + 1) + '/' + Math.ceil(cdUpdates.length/BATCH));
    }
  }

  const total = ddUpdates.length + cdUpdates.length;
  console.log('  Total updates:', total);
  return total;
}

(async () => {
  const d = await processSheet(DOVA, 'DOVA Project Sheet');
  const p = await processSheet(PERSONAL, 'Personal Sheet');
  console.log('\n=== DONE ===');
  console.log('Total updated:', (d||0) + (p||0));
})();