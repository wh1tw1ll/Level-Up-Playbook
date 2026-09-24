const https = require('https');
const fs = require('fs');

// Read token
const env = fs.readFileSync('C:\\Users\\HermesAdmin\\Level-Up-Playbook\\.env.local', 'utf8');
const tokenLine = env.split('\n').find(l => l.startsWith('SMARTSHEET_TOKEN'));
const token = tokenLine.split('=')[1].trim().replace(/"/g, '');

// Test with discussions include
const opts = {
  hostname: 'api.smartsheet.com',
  path: '/2.0/sheets/4456864287772548?include=columns,discussions&level=1',
  headers: { 'Authorization': 'Bearer ' + token }
};

https.get(opts, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    console.log('Sheet:', d.name);
    
    const cols = d.columns || [];
    const ddCol = cols.find(c => c.title === 'Due Date');
    const aCol = cols.find(c => c.title === 'Action ID');
    
    // Check first row's full cell data
    const rows = d.rows || [];
    if (rows.length > 0) {
      const row0 = rows[0];
      console.log('First row ID:', row0.id);
      console.log('Has discussions:', !!row0.discussions);
      if (row0.discussions) {
        console.log('Discussion count:', row0.discussions.length);
        row0.discussions.forEach((disc, i) => {
          console.log('  Disc ' + i + ': id=' + disc.id + ' commentCount=' + disc.commentCount);
        });
      }
      
      // Check all cells in first row
      console.log('First row cells:');
      for (const cell of (row0.cells || [])) {
        const col = cols.find(c => c.id === cell.columnId);
        if (col && col.title) {
          console.log('  ' + col.title + ': value=' + JSON.stringify(cell.value) + ' displayValue=' + JSON.stringify(cell.displayValue));
        }
      }
    }
    
    // Count due dates
    let withDD = 0;
    let withoutDD = 0;
    for (const row of rows.slice(0, 100)) {
      const ddCell = (row.cells || []).find(c => c.columnId === ddCol?.id);
      if (ddCell && ddCell.value) withDD++;
      else withoutDD++;
    }
    console.log('\nStats (first 100 rows):');
    console.log('With Due Date: ' + withDD);
    console.log('Without Due Date: ' + withoutDD);
    console.log('Total rows: ' + rows.length);
  });
}).on('error', e => console.log('Error:', e.message));