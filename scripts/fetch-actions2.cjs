const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const lines = envText.split('\n');
let token = '';
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('SMARTSHEET_TOKEN=*** {
    token = trimmed.split('=')[1].replace(/["']/g, '').trim();
    break;
  }
}
console.error('Token len=' + token.length + ' start=' + token.substring(0,5));

const SHEET_ID = '4975609129160580';
const url = `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}`;

const https = require('https');
https.get(url, {
  headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.error('Status:', res.statusCode);
    try {
      const data = JSON.parse(body);
      console.error('Keys:', Object.keys(data).join(', '));
      if (data.errorCode !== undefined) {
        console.error('API ERROR:', data.message);
        process.exit(1);
      }
      console.error('Sheet name:', data.name);
      console.error('Columns count:', data.columns ? data.columns.length : 0);
      if (data.columns) {
        data.columns.forEach(c => console.error(`  [${c.index}] ${c.title}`));
      }
    } catch(e) {
      console.error('Parse error:', e.message);
      console.error('Raw:', body.substring(0, 500));
    }
    process.exit(0);
  });
});