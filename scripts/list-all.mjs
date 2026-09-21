// scripts/list-all-attachments.mjs
import fs from 'fs';
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';
const data = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));
const TOKEN = data.access_token;

async function graph(method, url, body) {
  const full = 'https://graph.microsoft.com/v1.0/drives/' + DRIVE_ID + url;
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(full, opts);
  if (!res.ok) { const text = await res.text().catch(() => ''); throw new Error(method + ' ' + full + ' (' + res.status + '): ' + text.slice(0,200)); }
  if (method === 'DELETE') return null;
  return res.json();
}

async function main() {
  const folders = ['20260916', '20260917', '20260918'];
  for (const f of folders) {
    const r = await graph('GET', '/items/01J22VZXNFGEI76L4H75DJDJUE3BSQORKP/children:/' + f);
    // Actually use root path
  }
  // Just list each subfolder by listing children of the parent folder filtered by name
  const attList = await graph('GET', '/items/01J22VZXNFGEI76L4H75DJDJUE3BSQORKP/children');
  for (const sub of (attList.value || [])) {
    if (sub.folder && /^\d{8}$/.test(sub.name)) {
      const children = await graph('GET', '/items/' + sub.id + '/children');
      console.log(sub.name + ' (' + (children.value || []).length + ' items):');
      (children.value || []).forEach(i => console.log('  ' + (i.folder ? '[DIR]' : '[FILE]') + ' ' + i.name + ' ' + (i.size || 0) + 'b'));
    }
  }
}
main().catch(e => console.error('FATAL:', e.message));