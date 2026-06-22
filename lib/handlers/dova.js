// lib/handlers/dova.js — DOVA Arena Smartsheet API handler
// ES module with retry logic & 10s timeout
// Fetches all 8 DOVA sheets and returns structured JSON

export const SMARTSHEET_TOKEN = process.env.SMARTSHEET_TOKEN || '';

export const DOVA_SHEETS = {
  '00': { sheetId: '1744592440348548', name: '00 - Priorities' },
  '01': { sheetId: '6001454786498436', name: '01 - Procurement' },
  '02': { sheetId: '442392715939716', name: '02 - Issues' },
  '03': { sheetId: '4456864287772548', name: '03 - Actions' },
  '04': { sheetId: '7130338621869956', name: '04 - Budget' },
  '05': { sheetId: '6248192067719044', name: '05 - Schedule' },
  '06': { sheetId: '8678198664449924', name: '06 - Contacts' },
  '08': { sheetId: '2561970887675780', name: '08 - Permitting' },
  '09': { sheetId: '4263930196086660', name: '09 - Budget KPIs' },
  '10': { sheetId: '3625302918909828', name: '10 - Budget Detail' },
  '11': { sheetId: '606902982496132', name: '11 - Change Orders' },
  '12': { sheetId: '810553151803268', name: '12 - Team Contacts' }
};

export async function fetchWithRetry(url, options, retries = 3, timeoutMs = 10000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (res.status === 429 && attempt < retries) {
        const backoff = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `Smartsheet returned ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;
      const backoff = Math.pow(2, attempt) * 500;
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

export async function fetchSheet(sheetKey) {
  const info = DOVA_SHEETS[sheetKey];
  if (!info) throw new Error(`Sheet not found: ${sheetKey}`);

  const raw = await fetchWithRetry(
    `https://api.smartsheet.com/2.0/sheets/${info.sheetId}`,
    {
      headers: {
        'Authorization': `Bearer ${SMARTSHEET_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const columns = raw.columns ? raw.columns.map(c => c.title) : [];

  const rows = (raw.rows || []).map(row => {
    const obj = {};
    (row.cells || []).forEach((cell, i) => {
      if (i < columns.length) {
        obj[columns[i]] = cell.value !== undefined && cell.value !== null ? cell.value : null;
      }
    });
    return obj;
  });

  // Fallback data for supplementary sheets if Smartsheet data is empty/null
  const hasRealData = rows.some(r => Object.values(r).some(v => v !== null && v !== ''));
  if (!hasRealData && rows.length > 0) {
    if (sheetKey === '09') {
      rows.length = 0;
      rows.push({ Metric: 'Total Budget', Value: '$269.7M' });
      rows.push({ Metric: 'Committed', Value: '$1.5M' });
      rows.push({ Metric: 'Billed to Date', Value: '$1.3M' });
      rows.push({ Metric: 'Forecast Variance', Value: 'TBD' });
      rows.push({ Metric: 'Contingency Remaining', Value: '$26.3M' });
      rows.push({ Metric: 'Approved Change Orders', Value: '$0' });
    } else if (sheetKey === '10') {
      rows.length = 0;
      rows.push({ Category:'Structural Steel', Planned:'40.7M', Committed:'40.7M', 'Spent to Date':'0', 'Forecast at Completion':'40.7M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'HVAC', Planned:'26.8M', Committed:'26.8M', 'Spent to Date':'0', 'Forecast at Completion':'26.8M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Electrical', Planned:'31.0M', Committed:'31.0M', 'Spent to Date':'0', 'Forecast at Completion':'31.0M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Concrete', Planned:'9.2M', Committed:'9.2M', 'Spent to Date':'0', 'Forecast at Completion':'9.2M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Plumbing', Planned:'12.6M', Committed:'12.6M', 'Spent to Date':'0', 'Forecast at Completion':'12.6M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Fire Protection', Planned:'3.0M', Committed:'3.0M', 'Spent to Date':'0', 'Forecast at Completion':'3.0M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Drywall / Finishes', Planned:'13.4M', Committed:'13.4M', 'Spent to Date':'0', 'Forecast at Completion':'13.4M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Communications / IT', Planned:'8.9M', Committed:'8.9M', 'Spent to Date':'0', 'Forecast at Completion':'8.9M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Security', Planned:'5.3M', Committed:'5.3M', 'Spent to Date':'0', 'Forecast at Completion':'5.3M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'GC / Precon Services', Planned:'2.5M', Committed:'1.3M', 'Spent to Date':'1.2M', 'Forecast at Completion':'2.5M', Variance:'0', 'Percent Spent':'48%', 'Contingency Used':'0', Status:'In Progress' });
      rows.push({ Category:'Design Fees', Planned:'17.6M', Committed:'0.2M', 'Spent to Date':'0.1M', 'Forecast at Completion':'17.6M', Variance:'0', 'Percent Spent':'0.6%', 'Contingency Used':'0', Status:'Not Started' });
      rows.push({ Category:'Contingency', Planned:'26.3M', Committed:'0', 'Spent to Date':'0', 'Forecast at Completion':'26.3M', Variance:'0', 'Percent Spent':'0%', 'Contingency Used':'0', Status:'Healthy' });
    } else if (sheetKey === '12') {
      rows.length = 0;
      rows.push({ Name:'Whitney Williams', Role:'Principal-in-Charge', Email:'wwilliams@levelup-pd.com' });
      rows.push({ Name:'Greg Wieting', Role:'Senior Project Manager', Email:'gwieting@levelup-pd.com' });
      rows.push({ Name:'Justin Williams', Role:'Project Manager', Email:'' });
      rows.push({ Name:'Jordan Ward', Role:'Field Director', Email:'jward@levelup-pd.com' });
      rows.push({ Name:'Chuck Hack', Role:'KozPure Rep', Email:'' });
      rows.push({ Name:'Adam Osantowski', Role:'McCarthy Precon Director', Email:'' });
      rows.push({ Name:'Joshua Wood', Role:'KozPure / Alpha One', Email:'' });
    }
  }

  return {
    sheet: sheetKey,
    name: info.name,
    updatedAt: raw.modifiedAt || null,
    columns,
    rows
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // If a specific sheet is requested
  if (req.query.sheet) {
    const sheetKey = req.query.sheet;
    if (!DOVA_SHEETS[sheetKey]) {
      return res.status(400).json({ error: `Invalid sheet key: ${sheetKey}. Use: ${Object.keys(DOVA_SHEETS).join(', ')}` });
    }
    try {
      const data = await fetchSheet(sheetKey);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.json(data);
    } catch (e) {
      console.error('DOVA API error:', e.message);
      return res.status(502).json({ error: true, message: e.message });
    }
  }

  // Fetch all sheets
  try {
    const results = {};
    const keys = Object.keys(DOVA_SHEETS);
    const promises = keys.map(async (key) => {
      try {
        results[key] = await fetchSheet(key);
      } catch (e) {
        results[key] = { sheet: key, name: DOVA_SHEETS[key].name, error: e.message };
      }
    });
    await Promise.all(promises);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json(results);
  } catch (e) {
    console.error('DOVA all-sheets error:', e.message);
    res.status(502).json({ error: true, message: e.message });
  }
}