const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();

https.get('https://api.smartsheet.com/2.0/sheets/4456864287772548', { headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);
    console.log('Sheet:', s.name);
    console.log('Columns:');
    (s.columns || []).forEach(c => console.log('  ' + c.id + ' | ' + c.title + ' | ' + c.type));
    // Check a row with Granola prefix
    const granolaRow = (s.rows || []).find(r => {
      return (r.cells || []).some(c => c.value && typeof c.value === 'string' && c.value.includes('[Granola'));
    });
    if (granolaRow) {
      console.log('\nSample Granola row:');
      (granolaRow.cells || []).forEach(c => {
        const col = (s.columns || []).find(cx => cx.id === c.columnId);
        if (col && c.value) console.log('  ' + col.title + ': ' + JSON.stringify(c.value).substring(0, 100));
      });
    }
  });
});