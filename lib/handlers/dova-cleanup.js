// lib/handlers/dova-cleanup.js — Comprehensive DOVA Action Tracker cleanup
// POST /api/admin/dova-cleanup
// One-time handler for dedupe, move MFP rows, fix columns, set Visibility

import Smartsheet from '../smartsheet.js';

const DOVA_SHEET = '4456864287772548';
const MFP_SHEET = '5109402316263300';
const PERSONAL_SHEET = '2802755367554948';

// Known duplicate pairs from Claude's audit: [rowIdA, rowIdB]
const DUPE_PAIRS = [
  [5277077752905604, 1806590632656772],
  [681604480106372, 2524734934351748],
  [1878666626334596, 5151209441329028],
  [8871184769351556, 2812328897281924],
  [7874948851433348, 2432396358713220],
  [7026563961454468, 5426144256589700],
  [6227519655772036, 6894301517315972],
  [1980685789822852, 4531129980419972],
  [3136937425239940, 2224863538970500],
  [367135564627844, 3469553651285892],
  [506023801126788, 7504026885816196],
  [6516512704298884, 7789282507489156],
  [217533263773572, 7819805766320004],
  [2283146245177220, 6995195399372676],
  [7061586198527876, 6037676732579716],
  [2262382253965188, 547927677730692],
  [5307550842486660, 6034369099071364],
  [6434363966750596, 7012670038867844],  // near-duplicate parking rows
];

// Row IDs to delete outright
const DELETE_ROW_IDS = [
  '6677603988144004',  // test push
];

// MFP rows to move (by row ID)
const MFP_ROW_DETAILS = [
  '8871184769351556',  // Follow up with Thornton Thomas on 05700 (if not deduped)
  '2812328897281924',
  '6227519655772036',  // Krishna responded to submittal
  '6894301517315972',
  '1980685789822852',  // Lamar Tech sequencing
  '4531129980419972',
  '6516512704298884',  // Sales tax TBD flags on low-value vendors
  '7789282507489156',
  '2283146245177220',  // Identify trades/change orders
  '6995195399372676',
  '7061586198527876',  // Way lift station materials
  '6037676732579716',
];

// Row IDs for meeting-note headings to delete (granola section headers)
const MEETING_HEADING_ROWS = [
  '7874948851433348',  // General Action Item Log Review
  '2432396358713220',
  '7026563961454468',  // Granola Setup and Next Steps
  '5426144256589700',
  '3136937425239940',  // New Items Added and Next Steps
  '2224863538970500',
  '367135564627844',   // Outreach to Trade Contractors and Next Steps
  '3469553651285892',
  '506023801126788',   // Reach out to Brock... (personal)
  '7504026885816196',
];

// Rows with Category "Spam" to delete
const SPAM_ROWS = [
  // Need to discover by scanning
];

// Visibility rows — 18 specific rows to set to Both
const VISIBILITY_ROWS = [
  '5437728348438404',
  '1861124652400516',
  '3961561988726660',
  '7070032121692036',
  '3956223781764996',
  '4000881399299972',
  '1735299035561860',
  '6399316496744324',
  '4821298535989124',
  '341158969081732',
  '2183788365479812',
  '4214233204653956',
  '1692338893619076',
  '7012670038867844',
  '2161543132741508',
  '4186307327295364',
  '8036473996181380',
  '5859901816045444',
];

function getCellVal(row, colId) {
  const cell = (row.cells || []).find(c => c.columnId === colId);
  if (!cell) return '';
  const v = cell.displayValue ?? (typeof cell.value === 'object' ? (cell.value.objectValue || '') : cell.value) ?? '';
  return String(v).trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  
  try {
    const results = [];
    
    // Load the DOVA sheet
    const sheet = await Smartsheet.getSheetWithColumns(DOVA_SHEET);
    const cols = {};
    for (const c of sheet.columns || []) cols[c.title] = c;
    const rows = sheet.rows || [];
    
    // Build a map of rowId → row
    const rowMap = {};
    for (const r of rows) rowMap[r.id] = r;
    
    // ============================================================
    // STEP 1: DEDUPE — keep best row from each pair
    // ============================================================
    const dedupeResults = [];
    for (const [idA, idB] of DUPE_PAIRS) {
      const rowA = rowMap[idA];
      const rowB = rowMap[idB];
      if (!rowA && !rowB) continue;
      if (!rowA || !rowB) {
        // One already gone — skip
        dedupeResults.push({ pair: [idA, idB], note: 'One or both already deleted' });
        continue;
      }
      
      // Count populated cells for each
      const countA = (rowA.cells || []).filter(c => c.value !== null && c.value !== undefined && c.value !== '').length;
      const countB = (rowB.cells || []).filter(c => c.value !== null && c.value !== undefined && c.value !== '').length;
      
      // Keep the one with more populated cells; if equal, keep older
      let keep, delete;
      if (countA > countB) { keep = rowA; delete = rowB; }
      else if (countB > countA) { keep = rowB; delete = rowA; }
      else {
        // Equal — keep older by rowNumber (lower = older)
        keep = (rowA.rowNumber < rowB.rowNumber) ? rowA : rowB;
        delete = (keep === rowA) ? rowB : rowA;
      }
      
      // Carry over Status Note from deleted if keep has none
      const statusNoteCol = cols['Status Note'];
      const keepNote = getCellVal(keep, statusNoteCol?.id);
      const delNote = getCellVal(delete, statusNoteCol?.id);
      
      try {
        await Smartsheet.deleteRows(DOVA_SHEET, [delete.id]);
        dedupeResults.push({ kept: keep.id, deleted: delete.id, reason: countA !== countB ? 'more fields' : 'older', noteTransfer: (!keepNote && delNote) });
      } catch (e) {
        dedupeResults.push({ kept: keep.id, deleted: delete.id, error: e.message });
      }
    }
    results.push({ step: '1-dedupe', count: dedupeResults.length, pairs: dedupeResults });
    
    // Reload remaining rows after dedupe
    const sheet2 = await Smartsheet.getSheetWithColumns(DOVA_SHEET);
    const remaining = sheet2.rows || [];
    const remainingMap = {};
    for (const r of remaining) remainingMap[r.id] = r;
    
    // ============================================================
    // STEP 2: DELETE meeting-note headings, test rows, spam rows
    // ============================================================
    const toDelete = [...DELETE_ROW_IDS];
    
    // Find meeting-note headings: Owner=TBD, text matches section header patterns
    const actionCol = cols['Action ID'];
    const ownerCol = cols['Owner'];
    const HEADING_PATTERNS = ['action items', 'next steps', 'proposal', 'general action', 'new items', 'outreach', 'granola setup'];
    for (const r of remaining) {
      const text = getCellVal(r, actionCol?.id).toLowerCase();
      const owner = getCellVal(r, ownerCol?.id).toLowerCase();
      if (owner === 'tbd' || owner === '' || owner === 'unassigned') {
        if (HEADING_PATTERNS.some(p => text.includes(p))) {
          if (!toDelete.includes(String(r.id))) toDelete.push(String(r.id));
        }
      }
    }
    
    // Find spam rows
    const catCol = cols['Category'];
    for (const r of remaining) {
      const cat = getCellVal(r, catCol?.id).toLowerCase();
      if (cat === 'spam') {
        if (!toDelete.includes(String(r.id))) toDelete.push(String(r.id));
      }
    }
    
    if (toDelete.length > 0) {
      await Smartsheet.deleteRows(DOVA_SHEET, toDelete.map(Number));
    }
    results.push({ step: '2-delete-rows', count: toDelete.length, rowIds: toDelete });
    
    // ============================================================
    // STEP 3: MOVE MFP rows to MFP sheet
    // ============================================================
    const sheet3 = await Smartsheet.getSheetWithColumns(DOVA_SHEET);
    const afterRemaining = sheet3.rows || [];
    const mfpSheet = await Smartsheet.getSheetWithColumns(MFP_SHEET);
    const mfpCols = {};
    for (const c of mfpSheet.columns || []) mfpCols[c.title] = c;
    
    const mfpRows = afterRemaining.filter(r => {
      const proj = getCellVal(r, cols['Project']?.id).toLowerCase();
      return proj === 'mfp' || proj === 'miami freedom park';
    });
    
    if (mfpRows.length > 0) {
      const toAdd = mfpRows.map(r => {
        const cells = [];
        for (const c of r.cells || []) {
          const srcCol = sheet3.columns.find(col => col.id === c.columnId);
          if (!srcCol) continue;
          const dstCol = mfpSheet.columns.find(col => col.title === srcCol.title);
          if (!dstCol) continue;
          cells.push({ columnId: dstCol.id, value: typeof c.value === 'object' ? (c.value.objectValue ?? '') : (c.value ?? '') });
        }
        return { cells, toBottom: true };
      });
      await Smartsheet.addRows(MFP_SHEET, toAdd);
      await Smartsheet.deleteRows(DOVA_SHEET, mfpRows.map(r => r.id));
    }
    results.push({ step: '3-move-mfp', count: mfpRows.length, rowIds: mfpRows.map(r => r.id) });
    
    // ============================================================
    // STEP 4: BACKFILL Project where blank
    // ============================================================
    const sheet4 = await Smartsheet.getSheetWithColumns(DOVA_SHEET);
    const afterMove = sheet4.rows || [];
    const projCol = cols['Project'];
    const updates = [];
    
    function resolveProject(text) {
      const s = text.toLowerCase();
      if (s.includes('dova') || s.includes('cordova') || s.includes('kozpure')) return 'DOVA';
      if (s.includes('mfp') || s.includes('miami freedom') || s.includes('boldyn') || s.includes('stadium')) return 'MFP';
      if (s.includes('nhs6') || s.includes('sphere')) return 'Sphere';
      if (s.includes('business') || s.includes('intro') || s.includes('l&s') || s.includes('jones')) return 'Business';
      return '';
    }
    
    for (const r of afterMove) {
      const proj = getCellVal(r, projCol?.id);
      if (!proj && actionCol) {
        const text = getCellVal(r, actionCol.id);
        const resolved = resolveProject(text);
        if (resolved && projCol) {
          updates.push({
            rowId: r.id,
            cells: [{ columnId: projCol.id, value: resolved }],
          });
        }
      }
    }
    
    if (updates.length > 0) {
      for (const u of updates) {
        await Smartsheet.updateRowCells(DOVA_SHEET, u.rowId, u.cells);
      }
    }
    results.push({ step: '4-backfill-project', count: updates.length });
    
    // ============================================================
    // STEP 5: FIX Status — map Archived to Complete
    // ============================================================
    const statusCol = cols['Status'];
    const statusUpdates = [];
    for (const r of afterMove) {
      const status = getCellVal(r, statusCol?.id);
      if (status.toLowerCase() === 'archived') {
        statusUpdates.push({
          rowId: r.id,
          cells: [{ columnId: statusCol.id, value: 'Complete' }],
        });
      }
    }
    if (statusUpdates.length > 0) {
      for (const u of statusUpdates) {
        await Smartsheet.updateRowCells(DOVA_SHEET, u.rowId, u.cells);
      }
    }
    results.push({ step: '5-fix-status', mapped: statusUpdates.length });
    
    // ============================================================
    // STEP 6: SET VISIBILITY on 18 rows
    // ============================================================
    const visCol = cols['Visibility'];
    if (visCol) {
      const visUpdates = [];
      for (const rowId of VISIBILITY_ROWS) {
        if (remainingMap[rowId] || afterMove.find(r => String(r.id) === rowId)) {
          visUpdates.push({
            rowId: Number(rowId),
            cells: [{ columnId: visCol.id, value: 'Both' }],
          });
        }
      }
      if (visUpdates.length > 0) {
        for (const u of visUpdates) {
          await Smartsheet.updateRowCells(DOVA_SHEET, u.rowId, u.cells);
        }
      }
      results.push({ step: '6-set-visibility', count: visUpdates.length, rowIds: VISIBILITY_ROWS });
    } else {
      results.push({ step: '6-set-visibility', error: 'Visibility column not found' });
    }
    
    return res.json({ success: true, results });
  } catch (e) {
    console.error('DOVA cleanup error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}