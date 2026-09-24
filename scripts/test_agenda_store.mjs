#!/usr/bin/env node
// test_agenda_store.mjs — Quick test of agenda store write/read cycle
import smartsheet from '../lib/smartsheet.js';

const SID = '5131757151276932';

async function main() {
  const sheet = await smartsheet.getSheetWithColumns(SID);
  const colMap = {};
  for (const c of sheet.columns || []) colMap[c.title] = c.id;
  
  // Write test row
  await smartsheet.addRow(SID, [
    { columnId: colMap.MeetingSubject, value: 'TEST - DO NOT DELETE' },
    { columnId: colMap.MeetingTime, value: new Date().toISOString() },
    { columnId: colMap.DurationMinutes, value: '30' },
    { columnId: colMap.HasPriorNotes, value: false },
    { columnId: colMap.AgendaHtml, value: '<b>Test agenda write/read</b>' },
    { columnId: colMap.GeneratedAt, value: new Date().toISOString() },
  ]);
  console.log('✅ Test agenda written');

  // Read back
  const updated = await smartsheet.getSheet(SID);
  console.log('   Rows after write:', updated.rows.length);

  // Read cell value
  const row = updated.rows[updated.rows.length - 1];
  const subjectCell = (row.cells || []).find(c => c.columnId === colMap.MeetingSubject);
  console.log('   Subject:', subjectCell?.displayValue || subjectCell?.value);

  // Clean up
  const ids = updated.rows.map(r => r.id);
  await smartsheet.deleteRows(SID, ids);
  const final = await smartsheet.getSheet(SID);
  console.log('   Rows after cleanup:', final.rows.length);
  console.log('✅ Full write/read/delete cycle passes');
}

main().catch(e => console.error('❌', e.message));