// scripts/batch-move.js — Run locally to batch-move attachments into proper folders
// Usage: node scripts/batch-move.js
// First-time: opens browser for Microsoft device-code auth (one-time per token lifetime)

const TENANT = '8222d14d-0869-42d3-8b7f-858c65b89c0e';
const CLIENT_ID = 'f79b29d9-4f75-47db-ad18-9f99406872da';
const SCOPE = 'offline_access Files.ReadWrite.All Sites.ReadWrite.All User.Read';
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';

// ── ATTACHMENTS ROOT PATH ──
// Walk from SharePoint root through 05 - DOVA / Attachments
const ROOT_PATH = '05 - DOVA/Attachments';

// ── FILE OPERATIONS TABLE ──
const MOVES = [
  { match: 'B133-2019', dest: '02 - Contracts & Legal/04 - Third Party Contracts/Perkins Will/', name: 'B133-2019_Perkins+Will_Owner-Architect_CM as Constructor (12-17-21).docx' },
  { match: 'ARCH-Sacramento_Arena-V2.pdf', dest: '05 - Design & Engineering/01 - Drawings/04 - Schematic Design/', name: 'ARCH-Sacramento_Arena-V2.pdf' },
  { match: 'SD Kick-Off Agenda_NOTES.pdf', dest: '01 - Project Management/06 - Meeting Agendas & Minutes/03 - Project Team Meetings/', name: '260916_DOVA_SD Kick-Off Agenda_NOTES.pdf' },
  { match: 'KickOff_Pull Plan.xlsx', dest: '04 - Project Schedule/03 - Schedule Deliverables/', name: 'DOVA KickOff_Pull Plan.xlsx' },
  { match: 'Design Team Kick-Off [HOLD]_Transcript.docx', dest: '01 - Project Management/06 - Meeting Agendas & Minutes/03 - Project Team Meetings/', name: 'DOVA_Design Team Kick-Off [HOLD]_Transcript.docx' },
  { match: 'HaloSpecs.pdf', dest: '05 - Design & Engineering/07 - JCI Deliverables/', name: 'HaloSpecs.pdf' },
  { match: 'SkyGridSpecs.pdf', dest: '05 - Design & Engineering/07 - JCI Deliverables/', name: 'SkyGridSpecs.pdf' },
];

const DELETES = [
  'image001.png',
  'ARCH-Sacramento_Arena-V2_1.pdf',
  'Kick-Off Notes.pdf',
  'Preliminary Master Schedule.pdf',
  'KickOff_Pull Plan.pdf',
];

// ── END CONFIG ──

import { open, mkdir, writeFile, readFile } from 'fs/promises';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_CACHE = join(__dirname, '..', '.token-cache.json');

// ── HELPERS ──

async function graph(method, path, body, token) {
  const url = path.startsWith('root:')
    ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/${path}`
    : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${path}`;
  const opts = { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Graph ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  if (method === 'DELETE') return null;
  return res.json();
}

async function resolvePath(path, token) {
  const encoded = path.split('/').map(s => encodeURIComponent(s)).join('/');
  return graph('GET', `root:${encoded}`, null, token);
}

async function getDelegatedToken(refreshToken) {
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPE,
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  return data;
}

async function deviceCodeAuth() {
  // Step 1: Get device code
  const dcRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE }),
  });
  const dc = await dcRes.json();
  if (!dcRes.ok) throw new Error('Device code failed: ' + JSON.stringify(dc));

  console.log('\n' + '='.repeat(60));
  console.log('OPEN THIS URL IN YOUR BROWSER (after signing in to Microsoft):');
  console.log(dc.verification_uri);
  console.log('\nEnter this code when prompted:');
  console.log('  >>> ' + dc.user_code + ' <<<');
  console.log('='.repeat(60) + '\n');

  // Step 2: Poll for token
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 5000)); // 5s intervals per spec
    const trRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'device_code',
        device_code: dc.device_code,
      })
    });
    const tr = await trRes.json();
    if (trRes.ok) {
      console.log('Authenticated!');
      return tr;
    }
    if (tr.error === 'authorization_pending') continue;
    if (tr.error === 'slow_down') { await new Promise(r => setTimeout(r, 5000)); continue; }
    throw new Error('Auth failed: ' + JSON.stringify(tr));
  }
  throw new Error('Timed out waiting for authentication');
}

async function loadOrAuth() {
  // Try cached token first
  try {
    const cached = JSON.parse(await readFile(TOKEN_CACHE, 'utf-8'));
    if (cached.refresh_token && cached.expires_at > Date.now()) {
      try {
        const refreshed = await getDelegatedToken(cached.refresh_token);
        const token = refreshed.access_token;
        const rt = refreshed.refresh_token || cached.refresh_token;
        const expires_at = Date.now() + (refreshed.expires_in || 3600) * 1000;
        await writeFile(TOKEN_CACHE, JSON.stringify({ refresh_token: rt, expires_at }), 'utf-8');
        console.log('Token refreshed from cache. Valid until', new Date(expires_at).toISOString());
        return token;
      } catch (e) {
        console.log('Cached token expired, re-authenticating...');
      }
    }
  } catch (_) { /* no cache */ }

  // Device code flow
  const tokens = await deviceCodeAuth();
  const expires_at = Date.now() + (tokens.expires_in || 3600) * 1000;
  await writeFile(TOKEN_CACHE, JSON.stringify({ refresh_token: tokens.refresh_token, expires_at }), 'utf-8');
  console.log('Token cached. Valid until', new Date(expires_at).toISOString());
  return tokens.access_token;
}

// ── MAIN ──

async function main() {
  console.log('\nDOVA Attachments Batch Move\n');

  // 1. Auth
  console.log('Step 1: Authenticating...');
  const token = await loadOrAuth();
  console.log('  ✓ Authenticated\n');

  // 2. Resolve Attachments folder
  console.log('Step 2: Resolving Attachments folder...');
  let attachmentsId;
  try {
    const folder = await resolvePath(ROOT_PATH, token);
    attachmentsId = folder.id;
    console.log(`  ✓ Found: "${folder.name}" (${attachmentsId})\n`);
  } catch (e) {
    console.error('  ✗ Failed to find Attachments folder:', e.message);
    console.log('\nTry: listing root children to find the right path...');
    const root = await graph('GET', 'root/children', null, token);
    console.log('  Root children:', root.value?.map(i => i.name).join(', '));
    return;
  }

  // 3. List attachments
  console.log('Step 3: Listing attachments...');
  const list = await graph('GET', `${attachmentsId}/children`, null, token);
  const items = list.value || [];
  console.log(`  ✓ Found ${items.length} items:`);
  for (const i of items) {
    console.log(`    ${i.folder ? '[DIR]' : '[FILE]'} ${i.name} (${i.size || 0} bytes)`);
  }
  console.log();

  // 4. Resolve destination folders
  console.log('Step 4: Resolving destination folders...');
  const folderCache = {};
  for (const m of MOVES) {
    const destPath = `05 - DOVA/${m.dest}`;
    try {
      const f = await resolvePath(destPath, token);
      folderCache[m.dest] = f.id;
      console.log(`  ✓ ${m.dest} → ${f.id}`);
    } catch (e) {
      console.error(`  ✗ ${m.dest} → ${e.message}`);
    }
  }
  console.log();

  // 5. Execute moves
  console.log('Step 5: Moving files...');
  for (const m of MOVES) {
    const item = items.find(i => i.name.includes(m.match));
    if (!item) { console.error(`  ✗ NOT FOUND: ${m.match}`); continue; }
    const parentId = folderCache[m.dest];
    if (!parentId) { console.error(`  ✗ NO PARENT: ${m.match}`); continue; }
    try {
      await graph('PATCH', item.id, { parentReference: { id: parentId }, name: m.name }, token);
      console.log(`  ✓ ${item.name} → ${m.dest}${m.name}`);
    } catch (e) {
      console.error(`  ✗ FAILED: ${m.match} → ${e.message}`);
    }
  }
  console.log();

  // 6. Execute deletions
  console.log('Step 6: Deleting files...');
  for (const pattern of DELETES) {
    const item = items.find(i => i.name.includes(pattern));
    if (!item) { console.error(`  ✗ NOT FOUND: ${pattern}`); continue; }
    try {
      await graph('DELETE', item.id, null, token);
      console.log(`  ✓ Deleted: ${item.name}`);
    } catch (e) {
      console.error(`  ✗ FAILED: ${pattern} → ${e.message}`);
    }
  }
  console.log();

  // 7. Delete dated folders
  console.log('Step 7: Cleaning up dated folders in Attachments...');
  const subs = await graph('GET', `${attachmentsId}/children`, null, token);
  const datedFolders = (subs.value || []).filter(i => i.folder && /^\d{8}$/.test(i.name));
  for (const f of datedFolders) {
    try {
      await graph('DELETE', f.id, null, token);
      console.log(`  ✓ Deleted folder: ${f.name}`);
    } catch (e) {
      console.error(`  ✗ FAILED: ${f.name} → ${e.message}`);
    }
  }
  if (datedFolders.length === 0) console.log('  (no dated folders found)');
  console.log();

  // 8. Summary
  console.log('='.repeat(60));
  console.log('BATCH COMPLETE');
  console.log('Check the Attachments folder — remaining items should be few.');
}

main().catch(e => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});