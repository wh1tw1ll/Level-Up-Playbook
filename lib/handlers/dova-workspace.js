// dova-workspace.js — Move all DOVA sheets into the workspace
// Run once: curl https://level-up-playbook.vercel.app/api/dova-workspace

import { SMARTSHEET_TOKEN, fetchWithRetry } from './dova.js';

const WORKSPACE_ID = '4322039046662020';

const SHEET_IDS = [
  ['00', '1744592440348548'],
  ['01', '6001454786498436'],
  ['02', '442392715939716'],
  ['03', '4456864287772548'],
  ['04', '7130338621869956'],
  ['05', '6248192067719044'],
  ['06', '8678198664449924'],
  ['08', '2561970887675780'],
  ['09', '4263930196086660'],
  ['10', '3625302918909828'],
  ['11', '606902982496132'],
  ['12', '810553151803268']
];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const results = {};

  for (const [key, id] of SHEET_IDS) {
    try {
      // Move sheet to workspace
      const r = await fetchWithRetry(
        `https://api.smartsheet.com/2.0/sheets/${id}/move`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SMARTSHEET_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            destinationType: 'workspace',
            destinationId: WORKSPACE_ID
          })
        }
      );
      results[key] = { status: r.message || 'moved', sheetId: id };
    } catch (e) {
      // 404 or 400 likely means already in workspace or doesn't exist
      results[key] = { status: e.message.includes('already') ? 'already in workspace' : e.message, sheetId: id };
    }
  }

  res.json({ ok: true, results });
}