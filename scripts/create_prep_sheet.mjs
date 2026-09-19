// create_prep_sheet.mjs — Creates the LUCI Prep Map sheet if it doesn't exist
// Sheet creation goes through smartsheet.js wrapper (not directly)

import smartsheet from '../lib/smartsheet.js';

async function main() {
  console.log('Checking existing sheets...');
  const home = await smartsheet.getHome();
  console.log('Sheets found:', (home.sheets || []).length);

  const existing = (home.sheets || []).find(s => s.name === 'LUCI Prep Map');
  if (existing) {
    console.log('Prep map sheet already exists: ' + existing.id + ' | ' + existing.name);
    return;
  }

  const sheetDef = {
    name: 'LUCI Prep Map',
    columns: [
      { title: 'SeriesMasterId', type: 'TEXT_NUMBER', primary: true, width: 120 },
      { title: 'SeriesTitle', type: 'TEXT_NUMBER', width: 80 },
      { title: 'GranolaNoteId', type: 'TEXT_NUMBER', width: 60 },
      { title: 'GranolaNoteTitle', type: 'TEXT_NUMBER', width: 80 },
      { title: 'LastMatchedAt', type: 'DATE', width: 40 },
      { title: 'NoteMeetingDate', type: 'DATE', width: 40 },
      { title: 'NoteAgeDays', type: 'TEXT_NUMBER', width: 20 },
      { title: 'HasEverHadNote', type: 'CHECKBOX', width: 20 }
    ]
  };

  console.log('Creating prep map sheet...');
  const created = await smartsheet.createSheet('LUCI Prep Map', sheetDef.columns);
  console.log('Created sheet:', created.message || JSON.stringify(created));
  if (created.result) {
    console.log('Sheet ID:', created.result.id);
  }

  // Get column IDs
  const sheet = await smartsheet.getSheet(created.result.id);
  console.log('\nColumns:');
  (sheet.columns || []).forEach(c => console.log('  ' + c.id + ' | ' + c.title + ' | ' + c.type));
}

main().catch(e => console.log('Error:', e.message));