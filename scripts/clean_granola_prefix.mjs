// clean_granola_prefix.mjs — Strips [Granola:] prefix from Action ID rows
// Routes writes through smartsheet.js wrapper (not direct API calls)

import smartsheet from '../lib/smartsheet.js';
import guardedWrite from '../lib/guarded-write.js';

const PROJECT_SHEET = '4456864287772548';

async function main() {
  console.log('Fetching project sheet...');
  const sheet = await smartsheet.getSheet(PROJECT_SHEET);
  const actionCol = (sheet.columns || []).find(c => c.title === 'Action ID');
  if (!actionCol) { console.log('Action ID column not found'); return; }
  console.log('Action ID column:', actionCol.id);

  const rows = sheet.rows || [];
  const toFix = rows.filter(r => {
    const cell = (r.cells || []).find(c => c.columnId === actionCol.id);
    return cell && cell.value && typeof cell.value === 'string' && cell.value.startsWith('[Granola:');
  });

  console.log('Rows to fix:', toFix.length);

  let fixed = 0;
  for (const row of toFix) {
    const cell = (row.cells || []).find(c => c.columnId === actionCol.id);
    let text = cell.value;
    text = text.replace(/^\[Granola:[^\]]+\]\s*/, '');
    text = text.replace(/^\d+(\.\d+)?\.\s*/, '');
    text = text.trim();

    // Update via guardedWrite
    const result = await guardedWrite({
      sheetId: PROJECT_SHEET,
      smartsheet,
      existingRowId: row.id,
      columns: [
        { title: 'Action ID', columnId: actionCol.id, type: actionCol.type, value: text },
      ],
    });

    if (result.passed) {
      fixed++;
      console.log('Fixed row', row.id, ':', text.substring(0, 40));
    } else {
      console.log('FAIL row', row.id, ':', result.reason);
    }
  }

  console.log('\nDone. Fixed', fixed, 'rows.');
}

main().catch(e => console.log('Error:', e.message));