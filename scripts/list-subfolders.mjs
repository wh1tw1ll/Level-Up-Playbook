// scripts/list-subfolders.mjs
import fs from 'fs';

const conf = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));
const TOKEN = conf['access_token']; // indirect ref to avoid redaction issue
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';

async function listChildren(id) {
  const r = await fetch('https://graph.microsoft.com/v1.0/drives/' + DRIVE_ID + '/items/' + id + '/children', {
    headers: { Authorization: 'Bearer ' + TOKEN }
  });
  if (!r.ok) throw new Error('List children failed: ' + r.status);
  return (await r.json()).value || [];
}

async function main() {
  const attId = '01J22VZXNFGEI76L4H75DJDJUE3BSQORKP';
  const subs = await listChildren(attId);
  for (const sub of subs) {
    if (sub.folder && /^\d{8}$/.test(sub.name)) {
      const files = await listChildren(sub.id);
      console.log(sub.name + ' (' + files.length + ' items):');
      files.forEach(i => console.log('  ' + (i.folder ? '[DIR]' : '[FILE]') + ' ' + i.name));
    }
  }
}
main().catch(e => console.error('FATAL:', e.message));