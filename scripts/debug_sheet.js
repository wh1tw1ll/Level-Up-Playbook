const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const SHEET_ID = '1007659559112580';

https.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '?include=columns', { headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);
    console.log('Columns:');
    (s.columns || []).forEach(c => console.log('  ' + c.index + ': id=' + c.id + ' | title=' + c.title + ' | type=' + c.type + ' | primary=' + c.primary));
    console.log('\nRows:', (s.rows || []).length);
    (s.rows || []).forEach(r => {
      console.log('Row ' + r.rowNumber + ':');
      (r.cells || []).forEach(c => {
        const col = (s.columns || []).find(cx => cx.id === c.columnId);
        console.log('  ' + (col?.title || 'col' + c.columnId) + ': value=' + JSON.stringify(c.value));
      });
    });
  });
});