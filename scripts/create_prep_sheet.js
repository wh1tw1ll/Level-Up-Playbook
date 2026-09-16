const fs = require('fs');
const https = require('https');
const token = fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\.smartsheet_token', 'utf8').trim();

function ssheet(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.smartsheet.com/2.0' + path;
    const opts = {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(url, opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // List existing sheets
  const home = await ssheet('/home?include=sheets');
  console.log('=== Existing sheets ===');
  (home.sheets || []).forEach(s => console.log('  ' + s.id + ' | ' + s.name));

  // Check if prep map sheet exists
  const existing = (home.sheets || []).find(s => s.name === 'LUCI Prep Map');
  if (existing) {
    console.log('\nPrep map sheet already exists: ' + existing.id);
    return;
  }

  // Create the sheet
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

  const created = await ssheet('/sheets', 'POST', sheetDef);
  console.log('\nCreated sheet:', created.message || JSON.stringify(created));
  if (created.result) {
    console.log('Sheet ID:', created.result.id);
    console.log('Sheet URL:', created.result.accessLevel);
  }
  
  // Get column IDs
  const sheet = await ssheet('/sheets/' + created.result.id);
  console.log('\nColumn IDs:');
  (sheet.columns || []).forEach(c => console.log('  ' + c.id + ' | ' + c.title + ' | ' + c.type + ' | index=' + c.index));
}

main().catch(e => console.log('Error:', e.message));