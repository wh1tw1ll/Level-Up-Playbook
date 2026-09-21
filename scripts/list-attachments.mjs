// scripts/list-attachments.mjs
import fs from 'fs';
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';
const data = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));
const TOKEN = data.access_token;

async function graph(method, url, body) {
  const full = url.startsWith('http') ? url : 'https://graph.microsoft.com/v1.0/drives/' + DRIVE_ID + url;
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(full, opts);
  if (!res.ok) { const text = await res.text().catch(() => ''); throw new Error(method + ' ' + full + ' (' + res.status + '): ' + text.slice(0,200)); }
  if (method === 'DELETE') return null;
  return res.json();
}

async function resolvePath(path) {
  const segments = path.split('/').map(s => encodeURIComponent(s)).join('/');
  return graph('GET', '/root:/' + segments);
}

async function main() {
  // List attachments
  const att = await resolvePath('05 - DOVA/Attachments');
  console.log('Attachments folder:', att.id);
  const list = await graph('GET', '/items/' + att.id + '/children');
  const items = list.value || [];
  console.log('Items (' + items.length + '):');
  items.forEach(i => console.log('  ' + (i.folder ? '[DIR]' : '[FILE]') + ' ' + i.name + ' (' + i.id + ')'));

  // Check destination folders exist
  for (const dest of ['04 - Project Schedule/03 - Schedule Deliverables', '02 - Contracts & Legal/04 - Third Party Contracts/Perkins Will', '05 - Design & Engineering/01 - Drawings/04 - Schematic Design', '01 - Project Management/06 - Meeting Agendas & Minutes/03 - Project Team Meetings', '05 - Design & Engineering/07 - JCI Deliverables']) {
    try {
      const f = await resolvePath('05 - DOVA/' + dest);
      console.log('DEST OK: ' + dest + ' -> ' + f.id);
    } catch (e) {
      console.log('DEST MISSING: ' + dest);
    }
  }
}
main().catch(e => console.error('FATAL:', e.message));