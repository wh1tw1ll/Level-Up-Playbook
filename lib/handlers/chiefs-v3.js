// lib/handlers/chiefs-v3.js — KC Chiefs V3 dashboard API proxy
// Token from process.env.SMARTSHEET_TOKEN (set in Vercel env). Never exposed to client.

const SHEETS = {
  "01": { "sheetId": 6056924725333892, "name": "01 - Budget", "permalink": "" },
  "02": { "sheetId": 2990378205532036, "name": "02 - Schedule", "permalink": "" },
  "03": { "sheetId": 6150202825068420, "name": "03 - Action Items", "permalink": "" },
  "04": { "sheetId": 7416565342359428, "name": "04 - Project Snapshot", "permalink": "" },
  "05": { "sheetId": 3898403011383172, "name": "05 - Cash Flow Curve", "permalink": "" },
  "06": { "sheetId": 103661966413700, "name": "06 - KPI Metrics", "permalink": "" },
  "07": { "sheetId": 7295808041865092, "name": "07 - Procurement & Buyout", "permalink": "" },
  "08": { "sheetId": 8402002638753668, "name": "08 - Upcoming Key Decisions", "permalink": "" },
  "09": { "sheetId": 1666308507651972, "name": "09 - 90-Day Look-Ahead", "permalink": "" },
  "10": { "sheetId": 4607261593784196, "name": "10 - Risk Register", "permalink": "" },
  "11": { "sheetId": 3805124911648644, "name": "11 - Project Team", "permalink": "" },
  "12": { "sheetId": 1231443068931972, "name": "12 - Budget Position", "permalink": "" },
  "13": { "sheetId": 7173891100200836, "name": "13 - Health Scorecard", "permalink": "" },
  "14": { "sheetId": 8481118150938500, "name": "14 - Budget Detail", "permalink": "" },
  "15": { "sheetId": 1289895493455748, "name": "15 - Long Lead Items", "permalink": "" },
  "16": { "sheetId": 5737901064146820, "name": "16 - Change Order Log", "permalink": "" },
  "17": { "sheetId": 2200016243347332, "name": "17 - Contingency Log", "permalink": "" },
  "18": { "sheetId": 8674713801805700, "name": "18 - Pay Applications", "permalink": "" },
  "19": { "sheetId": 6549997775441796, "name": "19 - Phase Progress", "permalink": "" },
  "20": { "sheetId": 7705687575449476, "name": "20 - Permits & Inspections", "permalink": "" },
  "21": { "sheetId": 6725812261703556, "name": "21 - Budget KPIs", "permalink": "" },
  "22": { "sheetId": 1185570737835908, "name": "22 - Schedule KPIs", "permalink": "" }
};

function getToken() {
  return process.env.SMARTSHEET_TOKEN || '';
}

async function ssApi(path, retries = 3) {
  const url = 'https://api.smartsheet.com/2.0' + path;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
      }
    });
    if (res.status === 429 && attempt < retries) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      continue;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Smartsheet returned ' + res.status);
    }
    return res.json();
  }
}

async function fetchSheet(sheetKey) {
  const info = SHEETS[sheetKey];
  if (!info) throw new Error('Sheet not found: ' + sheetKey);

  const raw = await ssApi('/sheets/' + info.sheetId);
  const columns = raw.columns ? raw.columns.map(c => c.title) : [];
  const currencyCols = ['Planned Amount', 'Committed Amount', 'Spent to Date', 'Planned Cumulative', 'Actual Cumulative', 'Budget Value', 'Amount', 'Planned', 'Committed', 'Forecast at Completion'];

  const rows = (raw.rows || []).map(row => {
    const obj = {};
    (row.cells || []).forEach((cell, i) => {
      if (i < columns.length) {
        let val = cell.value !== undefined ? cell.value : null;
        if (val !== null && currencyCols.includes(columns[i])) {
          const num = Number(val);
          if (!isNaN(num)) val = '$' + (num / 1000000).toFixed(1) + 'M';
        }
        obj[columns[i]] = val;
      }
    });
    return obj;
  });

  return { sheet: sheetKey, name: info.name, permalink: raw.permalink || info.permalink, updatedAt: raw.modifiedAt, columns, rows };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.sheet === 'health') return res.json({ ok: true, sheets: Object.keys(SHEETS).length });

  const sheetKey = req.query.sheet;
  if (!sheetKey || !/^(\d{2})$/.test(sheetKey) || parseInt(sheetKey) < 1 || parseInt(sheetKey) > 22) {
    return res.status(400).json({ error: 'Invalid sheet key. Use 01-22.' });
  }

  try {
    const data = await fetchSheet(sheetKey);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json(data);
  } catch (e) {
    console.error('Chiefs V3 API error:', e.message);
    res.status(502).json({ error: true, message: e.message });
  }
}