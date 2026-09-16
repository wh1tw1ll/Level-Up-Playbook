const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();
const SHEET_ID = '1007659559112580';

// Build payload manually
const payload = {
  rows: [{
    toBottom: true,
    cells: [
      { columnId: 4939925902102404, value: "test_series_id_123" },
      { columnId: 2688126088417156, value: "Test Title" }
    ]
  }]
};

const bodyStr = JSON.stringify(payload);
console.log('Payload:', bodyStr);

const url = 'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows';
const req = https.request(url, { 
  method: 'POST', 
  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const r = JSON.parse(d);
    console.log('Status:', res.statusCode);
    console.log('Message:', r.message);
    if (r.result) {
      console.log('Row:', r.result.rowNumber, 'Cells:', r.result.cells.length);
      r.result.cells.forEach(c => console.log('  colId=' + c.columnId + ' value=' + JSON.stringify(c.value) + ' display=' + JSON.stringify(c.displayValue)));
    }
  });
});
req.write(bodyStr);
req.end();