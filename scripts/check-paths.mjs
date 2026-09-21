// scripts/check-paths.mjs
import fs from 'fs';
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';
const data = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));
const TOKEN = data.access_token;

async function graph(method, path, body) {
  const url = path.startsWith('root:')
    ? 'https://graph.microsoft.com/v1.0/drives/' + DRIVE_ID + '/' + path
    : 'https://graph.microsoft.com/v1.0/drives/' + DRIVE_ID + '/items/' + path;
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) { const text = await res.text().catch(() => ''); throw new Error(method + ' ' + path + ' (' + res.status + '): ' + text.slice(0,200)); }
  if (method === 'DELETE') return null;
  return res.json();
}

async function resolvePath(path) {
  const encoded = path.split('/').map(s => encodeURIComponent(s)).join('/');
  return graph('GET', 'root:' + encoded);
}

async function main() {
  // Test paths without "Shared Documents" prefix
  const paths = [
    '05 - DOVA/Attachments',
    '05 - DOVA/02 - Contracts & Legal/04 - Third Party Contracts/Perkins Will',
    '05 - DOVA/05 - Design & Engineering/01 - Drawings/04 - Schematic Design',
    '05 - DOVA/01 - Project Management/06 - Meeting Agendas & Minutes/03 - Project Team Meetings',
    '05 - DOVA/04 - Project Schedule/03 - Schedule Deliverables',
    '05 - DOVA/05 - Design & Engineering/07 - JCI Deliverables',
  ];
  for (const p of paths) {
    try {
      const result = await resolvePath(p);
      console.log(result.folder ? 'FOLDER' : 'FILE', p, '->', result.id);
      // List contents
      const children = await graph('GET', result.id + '/children');
      console.log('  ' + (children.value || []).length + ' items');
    } catch (e) {
      console.log('ERROR', p, ':', e.message.substring(0,100));
    }
  }
}
main().catch(e => console.error('FATAL:', e.message));