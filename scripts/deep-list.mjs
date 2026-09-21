// scripts/deep-list.mjs
import fs from 'fs';
const c = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));
const TK = c.access_token;
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';
async function ls(id) {
  const r = await fetch('https://graph.microsoft.com/v1.0/drives/' + DRIVE_ID + '/items/' + id + '/children', {headers:{Authorization:'Bearer '+TK}});
  if (!r.ok) throw new Error('fail');
  return (await r.json()).value||[];
}
async function walk(id,d) {
  const items = await ls(id);
  for (const i of items) {
    console.log(' '.repeat(d)+(i.folder?'[DIR]':'[FILE]')+' '+i.name);
    if (i.folder && d<12) await walk(i.id,d+2);
  }
}
async function main() {
  const subs = await ls('01J22VZXNFGEI76L4H75DJDJUE3BSQORKP');
  for (const s of subs) {
    if (s.folder) { console.log(s.name+':'); await walk(s.id,2); }
  }
}
main().catch(e=>console.error(e.message));