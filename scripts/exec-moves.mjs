// scripts/exec-moves.mjs — Execute file moves using cached MSAL token
import fs from 'fs';

const c = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));
const TK = c.access_token;
const DRIVE_ID = 'b!E0_TuL7Nn06AK05rVErw-wsS33fXt45AocqEeWrRTV_bI9Wvh3DjRYufso53f05D';

async function graph(m, url, body) {
  const u = url.startsWith('http') ? url : 'https://graph.microsoft.com/v1.0/drives/' + DRIVE_ID + url;
  const opts = { method: m, headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(u, opts);
  if (!r.ok) { const t = await r.text().catch(()=>''); throw new Error(m + ' ' + u.split('/').pop() + ' (' + r.status + '): ' + t.slice(0,200)); }
  if (m === 'DELETE') return null;
  return r.json();
}
const GET = (u) => graph('GET', u);
const DEL = (u) => graph('DELETE', u);
const PATCH = (u, b) => graph('PATCH', u, b);

function enc(s) { return s.split('/').map(x => encodeURIComponent(x)).join('/'); }

async function resolvePath(p) { return GET('/root:/' + enc(p)); }

// Walk folder tree collecting all files
async function collectFiles(folderId, depth) {
  const items = [];
  const children = await GET('/items/' + folderId + '/children');
  for (const i of (children.value || [])) {
    if (i.folder && depth < 10) {
      const sub = await collectFiles(i.id, depth + 1);
      items.push(...sub);
    } else if (!i.folder) {
      items.push(i);
    }
  }
  return items;
}

const MOVES = [
  { match: 'B133-2019', dest: '05 - DOVA/02 - Contracts & Legal/04 - Third Party Contracts/Perkins Will/', name: 'B133-2019_Perkins+Will_Owner-Architect_CM as Constructor (12-17-21).docx' },
  { match: 'ARCH-Sacramento_Arena-V2.pdf', dest: '05 - DOVA/05 - Design & Engineering/01 - Drawings/04 - Schematic Design/', name: 'ARCH-Sacramento_Arena-V2.pdf' },
  { match: 'SD Kick-Off Agenda_NOTES.pdf', dest: '05 - DOVA/01 - Project Management/06 - Meeting Agendas & Minutes/03 - Project Team Meetings/', name: '260916_DOVA_SD Kick-Off Agenda_NOTES.pdf' },
  { match: 'KickOff_Pull Plan.xlsx', dest: '05 - DOVA/04 - Project Schedule/03 - Schedule Deliverables/', name: 'DOVA KickOff_Pull Plan.xlsx' },
  { match: 'Design Team Kick-Off [HOLD]_Transcript.docx', dest: '05 - DOVA/01 - Project Management/06 - Meeting Agendas & Minutes/03 - Project Team Meetings/', name: 'DOVA_Design Team Kick-Off [HOLD]_Transcript.docx' },
  { match: 'HaloSpecs.pdf', dest: '05 - DOVA/05 - Design & Engineering/07 - JCI Deliverables/', name: 'HaloSpecs.pdf' },
  { match: 'SkyGridSpecs.pdf', dest: '05 - DOVA/05 - Design & Engineering/07 - JCI Deliverables/', name: 'SkyGridSpecs.pdf' },
];
const DELETES = ['image001.png', 'ARCH-Sacramento_Arena-V2_1.pdf', 'Kick-Off Notes.pdf', 'Preliminary Master Schedule.pdf', 'KickOff_Pull Plan.pdf'];

async function main() {
  // 1. Resolve attachments folder
  console.log('Step 1: Resolving Attachments folder...');
  const att = await resolvePath('05 - DOVA/Attachments');
  console.log('  Folder: ' + att.name + ' (' + att.id + ')\n');

  // 2. Collect ALL files recursively
  console.log('Step 2: Collecting all files recursively...');
  const allFiles = await collectFiles(att.id, 0);
  console.log('  Found ' + allFiles.length + ' total files across all subfolders\n');

  // 3. Resolve destination folders
  console.log('Step 3: Resolving destination folders...');
  const destCache = {};
  for (const m of MOVES) {
    try {
      const f = await resolvePath(m.dest);
      destCache[m.dest] = f.id;
      console.log('  OK: ' + m.dest + ' -> ' + f.id);
    } catch (e) {
      console.log('  MISSING: ' + m.dest);
    }
  }
  console.log();

  // 4. Execute moves
  console.log('Step 4: Moving files...');
  for (const m of MOVES) {
    const item = allFiles.find(i => i.name.includes(m.match));
    if (!item) { console.log('  NOT FOUND: ' + m.match); continue; }
    const parentId = destCache[m.dest];
    if (!parentId) { console.log('  NO PARENT: ' + m.match); continue; }
    try {
      // Delete existing at destination if same name
      const destChildren = await GET('/items/' + parentId + '/children');
      const existing = (destChildren.value || []).find(i => i.name === m.name);
      if (existing) { await DEL('/items/' + existing.id); console.log('  Removed existing: ' + m.name); }
      await PATCH('/items/' + item.id, { parentReference: { id: parentId }, name: m.name });
      console.log('  MOVED: ' + item.name + ' -> ' + m.name);
    } catch (e) {
      console.log('  FAILED: ' + m.match + ' - ' + e.message.substring(0,100));
    }
  }
  console.log();

  // 5. Execute deletes
  console.log('Step 5: Deleting files...');
  for (const pattern of DELETES) {
    const item = allFiles.find(i => i.name.includes(pattern));
    if (!item) { console.log('  NOT FOUND: ' + pattern); continue; }
    try {
      await DEL('/items/' + item.id);
      console.log('  DELETED: ' + item.name);
    } catch (e) {
      console.log('  FAILED: ' + pattern + ' - ' + e.message.substring(0,100));
    }
  }
  console.log();

  // 6. Remove dated subfolders (optional cleanup)
  console.log('Step 6: Cleaning up dated folders...');
  const attChildren = await GET('/items/' + att.id + '/children');
  const dated = (attChildren.value || []).filter(i => i.folder && /^\d{8}$/.test(i.name));
  for (const f of dated) {
    const contents = await GET('/items/' + f.id + '/children');
    if ((contents.value || []).length === 0) {
      await DEL('/items/' + f.id);
      console.log('  DELETED empty folder: ' + f.name);
    } else {
      const items = (contents.value || []).map(i => i.name).join(', ');
      console.log('  SKIPPED (not empty): ' + f.name + ' [' + items + ']');
    }
  }

  console.log('\n=== BATCH COMPLETE ===');
  // Verify: recount remaining
  const remaining = await collectFiles(att.id, 0);
  console.log('Remaining files in Attachments: ' + remaining.length);
  remaining.forEach(i => console.log('  ' + i.name));
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });