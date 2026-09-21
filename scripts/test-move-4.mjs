// scripts/test-move-4.mjs — Test move of file #4 only
import fs from 'fs';

const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';
const TOKEN_CACHE = 'C:/Users/HermesAdmin/.hermes/msal_tokens.json';

const data = JSON.parse(fs.readFileSync(TOKEN_CACHE, 'utf-8'));
const TOKEN = data.access_token;

async function graph(method, path, body) {
  const url = path.startsWith('root:')
    ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/${path}`
    : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${path}`;
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Graph ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  if (method === 'DELETE') return null;
  return res.json();
}

async function resolvePath(path) {
  const encoded = path.split('/').map(s => encodeURIComponent(s)).join('/');
  return graph('GET', 'root:' + encoded);
}

async function main() {
  const ATT_PATH = 'Shared Documents/05 - DOVA/Attachments';
  const DEST_PATH = 'Shared Documents/05 - DOVA/04 - Project Schedule/03 - Schedule Deliverables';

  console.log('1. Listing attachments...');
  const attFolder = await resolvePath(ATT_PATH);
  const list = await graph('GET', attFolder.id + '/children');
  const items = list.value || [];
  console.log('  ' + items.length + ' items found');
  const target = items.find(i => i.name.includes('KickOff_Pull Plan.xlsx'));
  if (!target) {
    console.log('  X Target NOT FOUND. Available:');
    items.forEach(i => console.log('    ' + (i.folder ? '[DIR]' : '[FILE]') + ' ' + i.name));
    return;
  }
  console.log('  Found: ' + target.name + ' (' + target.id + ')');

  console.log('2. Resolving destination...');
  const destFolder = await resolvePath(DEST_PATH);
  console.log('  Destination: ' + destFolder.name + ' (' + destFolder.id + ')');

  // Check if already exists
  const destContents = await graph('GET', destFolder.id + '/children');
  const existing = (destContents.value || []).find(i => i.name === 'DOVA KickOff_Pull Plan.xlsx');
  if (existing) {
    console.log('  File already exists at dest, deleting first...');
    await graph('DELETE', existing.id);
    console.log('  Deleted existing');
  }

  console.log('3. Moving file #4...');
  const result = await graph('PATCH', target.id, {
    parentReference: { id: destFolder.id },
    name: 'DOVA KickOff_Pull Plan.xlsx'
  });
  console.log('  Moved! New name: ' + result.name);

  // Verify
  const verify = await graph('GET', destFolder.id + '/children');
  const moved = (verify.value || []).find(i => i.name === 'DOVA KickOff_Pull Plan.xlsx');
  console.log('4. Verification: ' + (moved ? 'OK - file at destination, ' + moved.size + ' bytes' : 'FAILED - not found'));

  // List destination contents
  console.log('5. Destination now has:');
  (verify.value || []).forEach(i => console.log('    ' + i.name));

  console.log('\nTEST PASSED');
}
main().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });