const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const SHEET_ID = '1007659559112580';

// Try with displayValue instead of value
const payload = JSON.stringify({
  rows: [{
    toBottom: true,
    cells: [
      { columnId: 4939925902102404, displayValue: 'SERIES_CURL' },
      { columnId: 2688126088417156, displayValue: 'Curl Test' }
    ]
  }]
});

console.log('Payload:', payload);

const options = {
  hostname: 'api.smartsheet.com',
  path: '/2.0/sheets/' + SHEET_ID + '/rows',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const r = JSON.parse(d);
    console.log('Status:', res.statusCode);
    console.log('Result:', r.message);
    
    // Now GET to check values
    https.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, { headers: { 'Authorization': 'Bearer ' + token } }, (res2) => {
      let d2 = '';
      res2.on('data', c => d2 += c);
      res2.on('end', () => {
        const s = JSON.parse(d2);
        const lastRow = s.rows[s.rows.length - 1];
        if (lastRow) {
          console.log('Last row cells:');
          (lastRow.cells || []).forEach(c => {
            console.log('  colId=' + c.columnId + ' value=' + JSON.stringify(c.value) + ' displayValue=' + JSON.stringify(c.displayValue));
          });
        }
      });
    });
  });
});
req.write(payload);
req.end();