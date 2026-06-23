// lib/handlers/dova.js — DOVA Arena Smartsheet API handler
// ES module with retry logic & 10s timeout
// Fetches all 8 DOVA sheets and returns structured JSON

export const SMARTSHEET_TOKEN = process.env.SMARTSHEET_TOKEN || '';

export const DOVA_SHEETS = {
  '01': { sheetId: '6001454786498436', name: '01 - Procurement' },
  '02': { sheetId: '442392715939716', name: '02 - Exposure Log' },
  '03': { sheetId: '4456864287772548', name: '03 - Actions' },
  '04': { sheetId: '7130338621869956', name: '04 - Budget' },
  '05': { sheetId: '6248192067719044', name: '05 - Schedule' },
  '06': { sheetId: '6849002292072324', name: '06 - Contacts' },
  '08': { sheetId: '2561970887675780', name: '08 - Permitting' },
  '09': { sheetId: '4263930196086660', name: '09 - Budget KPIs' },
  '11': { sheetId: '606902982496132', name: '11 - Change Orders' }
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
  
  // Sheet 03 always uses combined data: existing actions + KozPure decisions from deck
  if (sheetKey === '03') {
    const existingActions = rows.slice(0);
    rows.length = 0;
    // Keep existing actionable items (the first 20 unique ones)
    const kept = [];
    const seen = new Set();
    for (const r of existingActions) {
      const id = r['Action ID'];
      if (id && !seen.has(id)) {
        seen.add(id);
        kept.push(r);
        if (kept.length >= 20) break;
      }
    }
    for (const r of kept) rows.push(r);
    // Add KozPure decision items from deck slide
    const kozItems = [
      { 'Action ID':'A-021', 'Action Description':'Approve owner-direct Perkins & Will / CMAR-preconstruction structure for SD launch', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'Critical', 'Status':'Pending', 'Depends On':'' },
      { 'Action ID':'A-022', 'Action Description':'Authorize Level Up to negotiate Perkins & Will SD scope, fee, schedule, and deliverables', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'Critical', 'Status':'Pending', 'Depends On':'A-021' },
      { 'Action ID':'A-023', 'Action Description':'Authorize Level Up to reset McCarthy into defined preconstruction services', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'Critical', 'Status':'Pending', 'Depends On':'' },
      { 'Action ID':'A-024', 'Action Description':'Confirm groundbreaking kickoff date', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'High', 'Status':'Pending', 'Depends On':'' },
      { 'Action ID':'A-025', 'Action Description':'Confirm delivery method evaluated after SD progress, pricing, and schedule validation', 'Owner':'KozPure', 'Due Date':'2026-07-30', 'Priority':'High', 'Status':'Pending', 'Depends On':'A-022' },
      { 'Action ID':'A-026', 'Action Description':'Confirm September groundbreaking as organizing schedule objective', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'High', 'Status':'Pending', 'Depends On':'A-024' },
      { 'Action ID':'A-027', 'Action Description':'Confirm March 2028 opening as target', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'High', 'Status':'Confirmed', 'Depends On':'' },
      { 'Action ID':'A-028', 'Action Description':'Confirm funding / sources and uses workstream', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'Critical', 'Status':'Pending', 'Depends On':'' },
      { 'Action ID':'A-029', 'Action Description':'Confirm entitlement / AHJ enablement workstream', 'Owner':'KozPure', 'Due Date':'2026-06-24', 'Priority':'High', 'Status':'Pending', 'Depends On':'' },
      { 'Action ID':'A-030', 'Action Description':'Confirm project insurance / CCIP vs OCIP next steps', 'Owner':'KozPure', 'Due Date':'2026-07-15', 'Priority':'High', 'Status':'Pending', 'Depends On':'A-029' },
      { 'Action ID':'A-031', 'Action Description':'Hold kickoff meetings with all primary project team members', 'Owner':'Level Up', 'Due Date':'2026-06-30', 'Priority':'High', 'Status':'Not Started', 'Depends On':'' },
      { 'Action ID':'A-032', 'Action Description':'Develop master budget', 'Owner':'Level Up', 'Due Date':'2026-07-15', 'Priority':'Critical', 'Status':'Not Started', 'Depends On':'A-022, A-023' },
      { 'Action ID':'A-033', 'Action Description':'Develop master schedule', 'Owner':'Level Up', 'Due Date':'2026-07-15', 'Priority':'Critical', 'Status':'Not Started', 'Depends On':'A-024, A-026' },
    ];
    for (const r of kozItems) rows.push(r);
  } else if (sheetKey === '05') {
    rows.length = 0;
    const scheduleData = [
      { id:'M-001', desc:'DOVA ARENA (Project Total)', start:'2026-06-15', finish:'2028-05-16', phase:'Project', pred:'' },
      { id:'M-002', desc:'Level Up Onboarding', start:'2026-06-15', finish:'2026-06-24', phase:'Predevelopment', pred:'' },
      { id:'M-003', desc:'Level Up Project Plan Presentation', start:'2026-06-24', finish:'2026-06-24', phase:'Predevelopment', pred:'M-002' },
      { id:'M-004', desc:'Conceptual / Programming Complete', start:'2026-06-15', finish:'2026-06-15', phase:'Design', pred:'' },
      { id:'M-005', desc:'SD Release / LNTP Executed', start:'2026-06-26', finish:'2026-06-26', phase:'Design', pred:'M-003' },
      { id:'M-006', desc:'Schematic Progress', start:'2026-06-26', finish:'2026-07-30', phase:'Design', pred:'M-005' },
      { id:'M-007', desc:'Concrete vs. Steel Superstructure Decision', start:'2026-06-26', finish:'2026-07-07', phase:'Design', pred:'M-005' },
      { id:'M-008', desc:'Schematic 100% Package Release', start:'2026-07-30', finish:'2026-07-30', phase:'Design', pred:'M-006' },
      { id:'M-009', desc:'SD Page Flip', start:'2026-07-31', finish:'2026-08-04', phase:'Design', pred:'M-008' },
      { id:'M-010', desc:'Updated Contractor Pricing, Procurement Log & Schedule (SD)', start:'2026-07-31', finish:'2026-08-11', phase:'Design', pred:'M-008' },
      { id:'M-011', desc:'Project Delivery Method / Procurement Evaluation (SD)', start:'2026-08-12', finish:'2026-08-13', phase:'Design', pred:'M-010' },
      { id:'M-012', desc:'Design Development (DD) Phase', start:'2026-07-31', finish:'2026-10-27', phase:'Design', pred:'M-008' },
      { id:'M-013', desc:'50% DD Contractor Updated Pricing, Procurement Log & Schedule', start:'2026-09-15', finish:'2026-09-21', phase:'Design', pred:'M-012' },
      { id:'M-014', desc:'100% DD Package Release', start:'2026-10-15', finish:'2026-10-15', phase:'Design', pred:'M-012' },
      { id:'M-015', desc:'100% DD Page Flip', start:'2026-10-16', finish:'2026-10-19', phase:'Design', pred:'M-014' },
      { id:'M-016', desc:'100% DD Contractor Updated Pricing, Procurement Log & Schedule', start:'2026-10-16', finish:'2026-10-27', phase:'Design', pred:'M-014' },
      { id:'M-017', desc:'Project Delivery Method / Procurement Evaluation (DD)', start:'2026-10-28', finish:'2026-10-29', phase:'Design', pred:'M-016' },
      { id:'M-018', desc:'Construction Documents (CD) Phase', start:'2026-10-16', finish:'2027-01-28', phase:'Design', pred:'M-014' },
      { id:'M-019', desc:'50% CD Page Flip', start:'2026-11-27', finish:'2026-11-30', phase:'Design', pred:'M-018' },
      { id:'M-020', desc:'50% CD GMP Deliverable', start:'2026-12-24', finish:'2026-12-24', phase:'Design', pred:'M-018' },
      { id:'M-021', desc:'GMP Review + Negotiation', start:'2026-12-25', finish:'2027-01-14', phase:'Design', pred:'M-020' },
      { id:'M-022', desc:'GMP Execution', start:'2027-01-14', finish:'2027-01-14', phase:'Design', pred:'M-021' },
      { id:'M-023', desc:'Permitting & AHJ Approvals Phase', start:'2026-06-29', finish:'2027-03-04', phase:'Permitting', pred:'' },
      { id:'M-024', desc:'AHJ + Permitting Strategy / Matrix Validation / Pre-Application Meetings', start:'2026-06-29', finish:'2026-07-24', phase:'Permitting', pred:'' },
      { id:'M-025', desc:'Early Site / Civil / Grading / Utility Permit', start:'2026-08-14', finish:'2026-09-17', phase:'Permitting', pred:'M-010' },
      { id:'M-026', desc:'Foundations Permit', start:'2026-09-11', finish:'2026-10-15', phase:'Permitting', pred:'M-012' },
      { id:'M-027', desc:'Superstructure / Seating Bowl Permit', start:'2026-10-19', finish:'2026-11-20', phase:'Permitting', pred:'M-015' },
      { id:'M-028', desc:'Full Building Permit', start:'2027-01-29', finish:'2027-03-04', phase:'Permitting', pred:'M-022' },
      { id:'M-029', desc:'Construction + TCO Phase', start:'2026-09-18', finish:'2028-03-21', phase:'Construction', pred:'' },
      { id:'M-030', desc:'Site Preparation & Utilities', start:'2026-09-18', finish:'2026-10-15', phase:'Construction', pred:'M-025' },
      { id:'M-031', desc:'Substructure', start:'2026-10-16', finish:'2026-11-26', phase:'Construction', pred:'M-026' },
      { id:'M-032', desc:'Superstructure & Seating Bowl', start:'2026-11-27', finish:'2027-07-29', phase:'Construction', pred:'M-031' },
      { id:'M-033', desc:'Building Enclosure', start:'2027-04-02', finish:'2027-10-07', phase:'Construction', pred:'M-032' },
      { id:'M-034', desc:'MEP Core / Vertical Transportation / IT-AV Rooms', start:'2027-07-16', finish:'2028-01-27', phase:'Construction', pred:'M-032' },
      { id:'M-035', desc:'Interior Buildout', start:'2027-07-16', finish:'2028-02-24', phase:'Construction', pred:'M-032' },
      { id:'M-036', desc:'Fixed Seating / Rails / Bowl Finishes', start:'2027-11-01', finish:'2028-03-03', phase:'Construction', pred:'M-032' },
      { id:'M-037', desc:'Final Sitework', start:'2028-01-15', finish:'2028-03-16', phase:'Construction', pred:'' },
      { id:'M-038', desc:'FF&E, Start-Up, Testing & Commissioning', start:'2028-02-10', finish:'2028-03-15', phase:'Construction', pred:'' },
      { id:'M-039', desc:'Life Safety / AHJ Inspections / TCO Readiness', start:'2028-02-10', finish:'2028-03-15', phase:'Construction', pred:'' },
      { id:'M-040', desc:'Substantial Completion / TCO', start:'2028-03-15', finish:'2028-03-15', phase:'Construction', pred:'M-038, M-039' },
      { id:'M-041', desc:'Event Ready', start:'2028-03-15', finish:'2028-03-21', phase:'Construction', pred:'M-040' },
      { id:'M-042', desc:'Final Completion Phase', start:'2028-03-15', finish:'2028-05-16', phase:'Closeout', pred:'M-040' },
      { id:'M-043', desc:'Punch / Closeout', start:'2028-03-15', finish:'2028-05-16', phase:'Closeout', pred:'M-040' },
      { id:'M-044', desc:'Final Certificate of Occupancy', start:'2028-03-15', finish:'2028-04-18', phase:'Closeout', pred:'M-040' },
    ];
    for (const item of scheduleData) {
      rows.push({
        'Milestone ID': item.id,
        'Description': item.desc,
        'Planned Start': item.start,
        'Planned Finish': item.finish,
        'Phase': item.phase,
        'Predecessor': item.pred
      });
    }
  } else if (!hasRealData && rows.length > 0) {
    if (sheetKey === '09') {
      rows.length = 0;
      rows.push({ Metric: 'Total Budget', Value: 'Not Set' });
      rows.push({ Metric: 'Budget Status', Value: 'Pending Approval' });
      rows.push({ Metric: 'McCarthy Estimate (May 2026)', Value: '$269.7M' });
      rows.push({ Metric: 'Committed (Precon)', Value: '$1.5M' });
      rows.push({ Metric: 'Billed to Date', Value: '$1.3M' });
      rows.push({ Metric: 'Contingency (McCarthy)', Value: '$26.3M' });
      rows.push({ Metric: 'Approved Change Orders', Value: '$0' });
    } else if (sheetKey === '10') {
      rows.length = 0;
      rows.push({ Category:'Structural Steel', Planned:'40.7M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'40.7M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'HVAC', Planned:'26.8M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'26.8M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Electrical', Planned:'31.0M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'31.0M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Concrete', Planned:'9.2M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'9.2M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Plumbing', Planned:'12.6M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'12.6M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Fire Protection', Planned:'3.0M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'3.0M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Drywall / Finishes', Planned:'13.4M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'13.4M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Communications / IT', Planned:'8.9M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'8.9M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Security', Planned:'5.3M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'5.3M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'GC / Precon Services', Planned:'2.5M (Est.)', Committed:'1.3M', 'Spent to Date':'1.2M', 'Forecast at Completion':'2.5M', Variance:'—', 'Percent Spent':'48%', 'Contingency Used':'—', Status:'Precon Active' });
      rows.push({ Category:'Design Fees', Planned:'17.6M (Est.)', Committed:'0.2M', 'Spent to Date':'0.1M', 'Forecast at Completion':'17.6M', Variance:'—', 'Percent Spent':'0.6%', 'Contingency Used':'—', Status:'Estimate Only' });
      rows.push({ Category:'Contingency', Planned:'26.3M (Est.)', Committed:'—', 'Spent to Date':'—', 'Forecast at Completion':'26.3M', Variance:'—', 'Percent Spent':'—', 'Contingency Used':'—', Status:'Estimate Only' });
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