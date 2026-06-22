// dova-seed.js — Populate DOVA supplementary sheets with data
import { SMARTSHEET_TOKEN, fetchWithRetry } from './dova.js';

const SHEETS = {
  '09': { id: '4263930196086660', cols: { Metric: 6313676448763780, Value: 4061876635078532 }, rows: [
    ['Total Budget', '$269.7M'], ['Committed', '$1.5M'], ['Billed to Date', '$1.3M'],
    ['Forecast Variance', 'TBD'], ['Contingency Remaining', '$26.3M'], ['Approved Change Orders', '$0']
  ]},
  '10': { id: '3625302918909828', cols: {}, rows: [
    ['Structural Steel','40.7M','40.7M','0','40.7M','0','0%','0','Not Started']
  ]},
  '12': { id: '810553151803268', cols: {}, rows: [
    ['Whitney Williams','Principal-in-Charge','wwilliams@levelup-pd.com'],
    ['Greg Wieting','Senior Project Manager','gwieting@levelup-pd.com'],
    ['Jordan Ward','Field Director','jward@levelup-pd.com']
  ]}
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const results = {};
  for (const [k, s] of Object.entries(SHEETS)) {
    try {
      const r = await fetchWithRetry(`https://api.smartsheet.com/2.0/sheets/${s.id}`,
        { headers: { Authorization: `Bearer ${SMARTSHEET_TOKEN}` } });
      const colMap = {};
      (r.columns || []).forEach(c => { colMap[c.title] = c.id; });
      const ids = (r.rows || []).map(r => r.id);
      if (ids.length)
        await fetchWithRetry(`https://api.smartsheet.com/2.0/sheets/${s.id}/rows?ids=${ids.join(',')}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${SMARTSHEET_TOKEN}` } });
      if (s.rows.length) {
        const payload = {
          rows: s.rows.map(row => ({
            cells: Object.entries(colMap).map(([title, cid], i) => ({
              columnId: cid,
              value: row[i] !== undefined ? row[i] : ''
            }))
          }))
        };
        await fetchWithRetry(`https://api.smartsheet.com/2.0/sheets/${s.id}/rows`,
          { method: 'POST', headers: { Authorization: `Bearer ${SMARTSHEET_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) });
      }
      results[k] = { status: 'ok', rows: s.rows.length };
    } catch (e) {
      results[k] = { status: 'error', message: e.message };
    }
  }
  res.json({ ok: true, results });
}