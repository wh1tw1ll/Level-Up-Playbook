// lib/handlers/dova.js — DOVA Arena Smartsheet API handler
// ES module with retry logic & 10s timeout
// Fetches all 8 DOVA sheets and returns structured JSON

export const SMARTSHEET_TOKEN = '62vwxuIsFXcctDSMbrfv0KmOqcDpLhr5QhDJd';

export const DOVA_SHEETS = {
  '00': { sheetId: '1744592440348548', name: '00 - Priorities' },
  '01': { sheetId: '6001454786498436', name: '01 - Procurement' },
  '02': { sheetId: '442392715939716', name: '02 - Issues' },
  '03': { sheetId: '4456864287772548', name: '03 - Actions' },
  '04': { sheetId: '7130338621869956', name: '04 - Budget' },
  '05': { sheetId: '6248192067719044', name: '05 - Schedule' },
  '06': { sheetId: '8678198664449924', name: '06 - Contacts' },
  '08': { sheetId: '2561970887675780', name: '08 - Permitting' }
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
        obj[columns[i]] = cell.value !== undefined ? cell.value : null;
      }
    });
    return obj;
  });

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