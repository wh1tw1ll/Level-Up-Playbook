// clear_prep_sheet.mjs — Deletes all rows from the Prep Map sheet
// Routes through smartsheet.js wrapper

import smartsheet from '../lib/smartsheet.js';

const PREP_MAP_SHEET = '1007659559112580';

async function main() {
  console.log('Fetching prep map sheet...');
  const sheet = await smartsheet.getSheet(PREP_MAP_SHEET);
  const rows = sheet.rows || [];
  console.log('Existing rows:', rows.length);

  if (rows.length === 0) {
    console.log('Sheet is already empty.');
    return;
  }

  const ids = rows.map(r => r.id);
  console.log('Deleting', ids.length, 'rows...');

  const result = await smartsheet.deleteRows(PREP_MAP_SHEET, ids);
  console.log('Delete result:', result.message || 'OK');

  const verify = await smartsheet.getSheet(PREP_MAP_SHEET);
  console.log('Remaining rows:', (verify.rows || []).length);
}

main().catch(e => console.log('Error:', e.message));