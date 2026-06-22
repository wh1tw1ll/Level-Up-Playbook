// dova-seed.js — Populate DOVA supplementary sheets with data
// Hit once after setup: curl https://level-up-playbook.vercel.app/api/dova-seed

import { SMARTSHEET_TOKEN, fetchWithRetry } from './dova.js';

const SHEETS = {
  '09': { sheetId: '4263930196086660', data: [
    { Metric: 'Total Budget', Value: '$269.7M' },
    { Metric: 'Committed', Value: '$1.5M' },
    { Metric: 'Billed to Date', Value: '$1.3M' },
    { Metric: 'Forecast Variance', Value: 'TBD' },
    { Metric: 'Contingency Remaining', Value: '$26.3M' },
    { Metric: 'Approved Change Orders', Value: '$0' }
  ]},
  '10': { sheetId: '3625302918909828', data: [
    { Category: 'Structural Steel', Planned: '40.7M', Committed: '40.7M', 'Spent to Date': '0', 'Forecast at Completion': '40.7M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'HVAC', Planned: '26.8M', Committed: '26.8M', 'Spent to Date': '0', 'Forecast at Completion': '26.8M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Electrical', Planned: '31.0M', Committed: '31.0M', 'Spent to Date': '0', 'Forecast at Completion': '31.0M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Plumbing', Planned: '12.6M', Committed: '12.6M', 'Spent to Date': '0', 'Forecast at Completion': '12.6M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Fire Protection', Planned: '3.0M', Committed: '3.0M', 'Spent to Date': '0', 'Forecast at Completion': '3.0M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Concrete', Planned: '9.2M', Committed: '9.2M', 'Spent to Date': '0', 'Forecast at Completion': '9.2M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Metal / Misc', Planned: '3.2M', Committed: '3.2M', 'Spent to Date': '0', 'Forecast at Completion': '3.2M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Roofing / Panels', Planned: '9.0M', Committed: '9.0M', 'Spent to Date': '0', 'Forecast at Completion': '9.0M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Drywall / Finishes', Planned: '13.4M', Committed: '13.4M', 'Spent to Date': '0', 'Forecast at Completion': '13.4M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Communications / IT', Planned: '8.9M', Committed: '8.9M', 'Spent to Date': '0', 'Forecast at Completion': '8.9M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Security', Planned: '5.3M', Committed: '5.3M', 'Spent to Date': '0', 'Forecast at Completion': '5.3M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Earthwork', Planned: '1.1M', Committed: '1.1M', 'Spent to Date': '0', 'Forecast at Completion': '1.1M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Elevators / Escalators', Planned: '2.7M', Committed: '2.7M', 'Spent to Date': '0', 'Forecast at Completion': '2.7M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'GC / Precon Services', Planned: '2.5M', Committed: '1.3M', 'Spent to Date': '1.2M', 'Forecast at Completion': '2.5M', Variance: '0', 'Percent Spent': '48%', 'Contingency Used': '0', Status: 'In Progress' },
    { Category: 'Design Fees', Planned: '17.6M', Committed: '0.2M', 'Spent to Date': '0.1M', 'Forecast at Completion': '17.6M', Variance: '0', 'Percent Spent': '0.6%', 'Contingency Used': '0', Status: 'Not Started' },
    { Category: 'Contingency', Planned: '26.3M', Committed: '0', 'Spent to Date': '0', 'Forecast at Completion': '26.3M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '0', Status: 'Healthy' }
  ]},
  '11': { sheetId: '606902982496132', data: [] },
  '12': { sheetId: '810553151803268', data: [
    { Name: 'Whitney Williams', Role: 'Principal-in-Charge', Email: 'wwilliams@levelup-pd.com' },
    { Name: 'Greg Wieting', Role: 'Senior Project Manager', Email: 'gwieting@levelup-pd.com' },
    { Name: 'Justin Williams', Role: 'Project Manager', Email: '' },
    { Name: 'Jordan Ward', Role: 'Field Director', Email: 'jward@levelup-pd.com' },
    { Name: 'Chuck Hack', Role: 'KozPure Rep', Email: '' },
    { Name: 'Adam Osantowski', Role: 'McCarthy Precon Director', Email: '' },
    { Name: 'Joshua Wood', Role: 'KozPure / Alpha One', Email: '' }
  ]}
};

async function getColMap(sheetId) {
  const res = await fetchWithRetry(
    `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
    { headers: { Authorization: `Bearer ${SMARTSHEET_TOKEN}` } }
  );
  const map = {};
  (res.columns || []).forEach(c => { map[c.title] = c.id; });
  return map;
}

async function clearRows(sheetId) {
  const res = await fetchWithRetry(
    `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
    { headers: { Authorization: `Bearer ${SMARTSHEET_TOKEN}` } }
  );
  const ids = (res.rows || []).map(r => r.id);
  if (!ids.length) return;
  await fetchWithRetry(
    `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${SMARTSHEET_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    }
  );
}

async function addRows(sheetId, rows, colMap) {
  if (!rows.length) return;
  const payload = {
    rows: rows.map(r => ({
      cells: Object.entries(r).map(([key, val]) => ({
        columnId: colMap[key],
        value: val
      }))
    }))
  };
  await fetchWithRetry(
    `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SMARTSHEET_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const results = {};

  for (const [key, info] of Object.entries(SHEETS)) {
    try {
      const colMap = await getColMap(info.sheetId);
      await clearRows(info.sheetId);
      await addRows(info.sheetId, info.data, colMap);
      results[key] = { status: 'seeded', rows: info.data.length };
    } catch (e) {
      results[key] = { status: 'error', message: e.message };
    }
  }

  res.json({ ok: true, results });
}