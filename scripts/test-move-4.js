// scripts/test-move-4.js — Test file #4 move only
// Run: node scripts/test-move-4.js
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';

import fs from 'fs';
const data = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));
const TOKEN = data.access_token;

async function graph(method, path, body) {
  const url = path.startsWith('root:')
    ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/${path}`
    : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${path}`;
  const opts = { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } };
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
  return graph('GET', `root:${encoded}`);
}

async function main() {
  const ATTACH_PATH = 'Shared Documents/05 - DOVA/Attachments';
  const DEST_PATH = 'Shared Documents/05 - DOVA/04 - Project Schedule/03 - Schedule Deliverables';

  console.log('Step 1: Listing attachments...');
  const attFolder = await resolvePath(ATTACH_PATH);
  const list = await graph('GET', `${attFolder.id}/children`);
  const items = list.value || [];
  console.log(`  ${items.length} items found`);

  // File #4: KickOff_Pull Plan.xlsx
  const target = items.find(i => i.name.includes('KickOff_Pull Plan.xlsx'));
  if (!target) {
    console.log('  ✗ Target "KickOff_Pull Plan.xlsx" NOT FOUND in attachments');
    console.log('  Available files:', items.map(i => i.name).join(', '));
    return;
  }
  console.log(`  ✓ Found: ${target.name} (${target.id})`);

  // Resolve destination folder
  console.log('\nStep 2: Resolving destination...');
  const destFolder = await resolvePath(DEST_PATH);
  console.log(`  ✓ Destination: "${destFolder.name}" (${destFolder.id})`);

  // List destination contents first
  const destContents = await graph('GET', `${destFolder.id}/children`);
  console.log(`  Destination has ${(destContents.value || []).length} items:`);
  (destContents.value || []).forEach(i => console.log(`    ${i.name}`));

  // Check if file already exists at destination
  const existing = (destContents.value || []).find(i => i.name === 'DOVA KickOff_Pull Plan.xlsx');
  if (existing) {
    console.log(`\n  ⚠ File "DOVA KickOff_Pull Plan.xlsx" already exists at destination (${existing.id})`);
    console.log('  Deleting it first...');
    await graph('DELETE', existing.id);
    console.log('  ✓ Deleted existing');
  }

  // Test: read file metadata to confirm we have access
  console.log('\nStep 3: Testing read access on source file...');
  const fileMeta = await graph('GET', target.id);
  console.log(`  ✓ File: ${fileMeta.name}, ${fileMeta.size} bytes, modified ${fileMeta.lastModifiedDateTime}`);

  // Move: update parentReference and optional rename
  console.log('\nStep 4: Moving file #4...');
  const result = await graph('PATCH', target.id, {
    parentReference: { id: destFolder.id },
    name: 'DOVA KickOff_Pull Plan.xlsx'
  });
  console.log(`  ✓ Moved! New name: "${result.name}"`);
  console.log(`  ✓ New parent: ${result.parentReference?.driveId || 'unknown'}`);
  
  // Verify
  console.log('\nStep 5: Verification - listing destination...');
  const verifyContents = await graph('GET', `${destFolder.id}/children`);
  const moved = (verifyContents.value || []).find(i => i.name === 'DOVA KickOff_Pull Plan.xlsx');
  console.log(`  ✓ File at destination: ${moved ? moved.name : 'NOT FOUND - FAILED'}`);
  if (moved) console.log(`  ✓ Size: ${moved.size} bytes`);

  console.log('\nTEST PASSED');
}

main().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });