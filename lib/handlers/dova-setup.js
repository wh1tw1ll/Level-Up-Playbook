// lib/handlers/dova-setup.js — Create DOVA supplementary sheets for Chiefs-style dashboard
// Run once: curl https://level-up-playbook.vercel.app/api/dova-setup

import { SMARTSHEET_TOKEN, fetchWithRetry } from './dova.js';

const WORKSPACE_ID = '4322039046662020';

const SHEET_DEFS = {
  '09 - Budget KPIs': {
    columns: [
      { title: 'Metric', type: 'TEXT_NUMBER', primary: true },
      { title: 'Value', type: 'TEXT_NUMBER' }
    ],
    rows: [
      { Metric: 'Total Budget', Value: '269.7M' },
      { Metric: 'Committed', Value: '1.5M' },
      { Metric: 'Billed to Date', Value: '1.3M' },
      { Metric: 'Forecast Variance', Value: 'TBD' },
      { Metric: 'Contingency Remaining', Value: '26.3M' },
      { Metric: 'Approved Change Orders', Value: '$0' }
    ]
  },
  '10 - Budget Detail': {
    columns: [
      { title: 'Category', type: 'TEXT_NUMBER', primary: true },
      { title: 'Planned', type: 'TEXT_NUMBER' },
      { title: 'Committed', type: 'TEXT_NUMBER' },
      { title: 'Spent to Date', type: 'TEXT_NUMBER' },
      { title: 'Forecast at Completion', type: 'TEXT_NUMBER' },
      { title: 'Variance', type: 'TEXT_NUMBER' },
      { title: 'Percent Spent', type: 'TEXT_NUMBER' },
      { title: 'Contingency Used', type: 'TEXT_NUMBER' },
      { title: 'Status', type: 'TEXT_NUMBER' }
    ],
    rows: [
      { Category: 'Structural Steel', Planned: '40.7M', Committed: '40.7M', 'Spent to Date': '0', 'Forecast at Completion': '40.7M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'HVAC', Planned: '26.8M', Committed: '26.8M', 'Spent to Date': '0', 'Forecast at Completion': '26.8M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Electrical', Planned: '31.0M', Committed: '31.0M', 'Spent to Date': '0', 'Forecast at Completion': '31.0M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Plumbing', Planned: '12.6M', Committed: '12.6M', 'Spent to Date': '0', 'Forecast at Completion': '12.6M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Fire Protection', Planned: '3.0M', Committed: '3.0M', 'Spent to Date': '0', 'Forecast at Completion': '3.0M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Concrete', Planned: '9.2M', Committed: '9.2M', 'Spent to Date': '0', 'Forecast at Completion': '9.2M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Metal / Misc', Planned: '3.2M', Committed: '3.2M', 'Spent to Date': '0', 'Forecast at Completion': '3.2M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Roofing / Panels', Planned: '9.0M', Committed: '9.0M', 'Spent to Date': '0', 'Forecast at Completion': '9.0M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Drywall / Finishes', Planned: '13.4M', Committed: '13.4M', 'Spent to Date': '0', 'Forecast at Completion': '13.4M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Communications / IT', Planned: '8.9M', Committed: '8.9M', 'Spent to Date': '0', 'Forecast at Completion': '8.9M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Security', Planned: '5.3M', Committed: '5.3M', 'Spent to Date': '0', 'Forecast at Completion': '5.3M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Earthwork', Planned: '1.1M', Committed: '1.1M', 'Spent to Date': '0', 'Forecast at Completion': '1.1M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Elevators / Escalators', Planned: '2.7M', Committed: '2.7M', 'Spent to Date': '0', 'Forecast at Completion': '2.7M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'GC / Precon Services', Planned: '2.5M', Committed: '1.3M', 'Spent to Date': '1.2M', 'Forecast at Completion': '2.5M', Variance: '0', 'Percent Spent': '48%', 'Contingency Used': '$0', Status: 'In Progress' },
      { Category: 'Design Fees', Planned: '17.6M', Committed: '0.2M', 'Spent to Date': '0.1M', 'Forecast at Completion': '17.6M', Variance: '0', 'Percent Spent': '0.6%', 'Contingency Used': '$0', Status: 'Not Started' },
      { Category: 'Contingency', Planned: '26.3M', Committed: '0', 'Spent to Date': '0', 'Forecast at Completion': '26.3M', Variance: '0', 'Percent Spent': '0%', 'Contingency Used': '$0', Status: 'Healthy' }
    ]
  },
  '11 - Change Orders': {
    columns: [
      { title: 'CO Number', type: 'TEXT_NUMBER', primary: true },
      { title: 'Description', type: 'TEXT_NUMBER' },
      { title: 'Type', type: 'TEXT_NUMBER' },
      { title: 'Value', type: 'TEXT_NUMBER' },
      { title: 'Funding Source', type: 'TEXT_NUMBER' },
      { title: 'Status', type: 'TEXT_NUMBER' },
      { title: 'Date', type: 'TEXT_NUMBER' }
    ],
    rows: []
  },
  '12 - Team Contacts': {
    columns: [
      { title: 'Name', type: 'TEXT_NUMBER', primary: true },
      { title: 'Role', type: 'TEXT_NUMBER' },
      { title: 'Email', type: 'TEXT_NUMBER' }
    ],
    rows: [
      { Name: 'Whitney Williams', Role: 'Principal-in-Charge', Email: 'wwilliams@levelup-pd.com' },
      { Name: 'Greg Wieting', Role: 'Senior Project Manager', Email: 'gwieting@levelup-pd.com' },
      { Name: 'Justin Williams', Role: 'Project Manager', Email: 'jwilliams@levelup-pd.com' },
      { Name: 'Jordan Ward', Role: 'Field Director', Email: 'jward@levelup-pd.com' },
      { Name: 'Chuck Hack', Role: 'KozPure Owner Representative', Email: '' },
      { Name: 'Adam Osantowski', Role: 'McCarthy Precon Director', Email: '' },
      { Name: 'Joshua Wood', Role: 'KozPure / Alpha One', Email: '' }
    ]
  }
};

async function createSheet(name, def) {
  const body = {
    name,
    columns: def.columns.map((c, i) => ({
      title: c.title,
      type: c.type || 'TEXT_NUMBER',
      primary: i === 0
    }))
  };
  const res = await fetchWithRetry(
    `https://api.smartsheet.com/2.0/workspaces/${WORKSPACE_ID}/sheets`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SMARTSHEET_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  return res.result ? res.result.id : res.id;
}

async function populateSheet(sheetId, def) {
  const colRes = await fetchWithRetry(
    `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
    {
      headers: { 'Authorization': `Bearer ${SMARTSHEET_TOKEN}` }
    }
  );
  const colMap = {};
  (colRes.columns || []).forEach(c => { colMap[c.title] = c.id; });

  const rows = def.rows.map(rowData => ({
    cells: Object.entries(rowData).map(([key, val]) => ({
      columnId: colMap[key],
      value: val
    }))
  }));

  if (rows.length === 0) return;

  await fetchWithRetry(
    `https://api.smartsheet.com/2.0/sheets/${sheetId}/rows`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SMARTSHEET_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rows })
    }
  );
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const results = {};
    for (const [name, def] of Object.entries(SHEET_DEFS)) {
      try {
        const sheetId = await createSheet(name, def);
        await populateSheet(sheetId, def);
        results[name] = { status: 'created', sheetId };
      } catch (e) {
        results[name] = { status: 'error', message: e.message };
      }
    }
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
