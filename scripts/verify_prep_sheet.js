const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const SHEET_ID = '1007659559112580';

https.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '?include=rows', { headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);
    console.log('Sheet: ' + s.name);
    console.log('Rows: ' + (s.rows || []).length);
    console.log('');
    (s.rows || []).forEach(r => {
      const cells = r.cells || [];
      console.log('--- Row ' + r.rowNumber + ' ---');
      cells.forEach(c => {
        const col = (s.columns || []).find(cx => cx.id === c.columnId);
        if (col && (c.value || c.displayValue)) {
          console.log('  ' + col.title + ': ' + (c.displayValue || c.value));
        }
      });
    });
  });
});