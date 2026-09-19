// dova-classify.js — Temporary endpoint to apply 64 classifications, delete 2 rows, move 9 rows, etc.
// Called via: curl https://level-up-playbook.vercel.app/api/dova-classify (POST)
// Delete this endpoint after use.

import smartsheet from '../lib/smartsheet.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const DOVA = '4456864287772548';
    const MFP = '5109402316263300';
    const results = { classification: [], deletions: [], moves: [], ambiguous: [], businessProject: [], errors: [] };

    // ── COLUMN IDS ──
    const CATEGORY_COL = '146108531380100'; // index 7, MULTI_PICKLIST
    const DISCIPLINE_COL = '5143077301555076'; // index 8, MULTI_PICKLIST

    // First, get the sheet to find Project column ID
    const sheet = await smartsheet.getSheetWithColumns(DOVA);
    const cols = {};
    for (const c of sheet.columns || []) cols[c.title] = c;
    const PROJECT_COL = cols['Project']?.id;
    if (!PROJECT_COL) throw new Error('Project column not found');
    results.projectColId = PROJECT_COL;

    // Also get column map for MFP sheet with column types
    const mfpSheet = await smartsheet.getSheetWithColumns(MFP);
    const mfpCols = {};
    for (const c of mfpSheet.columns || []) mfpCols[c.title] = { id: c.id, type: c.type, options: c.options || [] };
    // Debug: log column info
    results.dovaCols = (sheet.columns || []).map(c => ({ title: c.title, id: c.id, type: c.type }));
    results.mfpCols = (mfpSheet.columns || []).map(c => ({ title: c.title, id: c.id, type: c.type }));

    // Helper: build cell value with proper format for picklist columns
    function buildCellValue(colId, value, colType) {
      if (!value || value === '') return null;
      // MULTI_PICKLIST and PICKLIST columns require objectValue format
      if (colType === 'MULTI_PICKLIST' || colType === 'PICKLIST') {
        return { columnId: colId, objectValue: { displayValue: String(value) } };
      }
      return { columnId: colId, value: value };
    }

    // ── 1. CLASSIFY 64 ROWS ──
    const classifications = [
      // ENTITLEMENTS (13 rows - Category=ENTITLEMENTS)
      { rowId: '6399316496744324', category: 'ENTITLEMENTS', discipline: 'Traffic' },
      { rowId: '2446716613164932', category: 'ENTITLEMENTS', discipline: 'Traffic' },
      { rowId: '186626438856580', category: 'ENTITLEMENTS', discipline: 'Traffic' },
      { rowId: '2183788365479812', category: 'ENTITLEMENTS', discipline: 'Traffic' },
      { rowId: '4821298535989124', category: 'ENTITLEMENTS', discipline: 'Planning & Zoning' },
      { rowId: '1692338893619076', category: 'ENTITLEMENTS', discipline: 'Planning & Zoning' },
      { rowId: '7012670038867844', category: 'ENTITLEMENTS', discipline: 'Planning & Zoning' },
      { rowId: '341158969081732', category: 'ENTITLEMENTS', discipline: 'Environmental' },
      { rowId: '5437728348438404', category: 'ENTITLEMENTS', discipline: 'Environmental' },
      { rowId: '1861124652400516', category: 'ENTITLEMENTS', discipline: 'Public Works' },
      { rowId: '4000881399299972', category: 'ENTITLEMENTS', discipline: 'Public Works' },
      { rowId: '3961561988726660', category: 'ENTITLEMENTS', discipline: 'Public Works' },
      { rowId: '1735299035561860', category: 'ENTITLEMENTS', discipline: 'Public Works' },
      // FINANCIAL (12) - Category=FINANCIAL
      { rowId: '8308880104226692', category: 'FINANCIAL', discipline: 'Budget' },
      { rowId: '8036473996181380', category: 'FINANCIAL', discipline: 'Budget' },
      { rowId: '4808963331194756', category: 'FINANCIAL', discipline: 'Draw & Pay Application' },
      { rowId: '7369908885782404', category: 'FINANCIAL', discipline: 'Change Orders' },
      { rowId: '2568390999408516', category: 'FINANCIAL', discipline: 'Change Orders' },
      { rowId: '2047537252401028', category: 'FINANCIAL', discipline: 'Change Orders' },
      { rowId: '5068027605942148', category: 'FINANCIAL', discipline: 'Change Orders' },
      { rowId: '8083307600936836', category: 'FINANCIAL', discipline: 'Change Orders' },
      { rowId: '1580152440618884', category: 'FINANCIAL', discipline: 'Change Orders' },
      { rowId: '7978183250411396', category: 'FINANCIAL', discipline: 'Estimating' },
      { rowId: '7910410813964164', category: 'FINANCIAL', discipline: 'Estimating' },
      { rowId: '3888313906364292', category: 'FINANCIAL', discipline: 'Estimating' },
      // GENERAL COORDINATION (8) - Category=GENERAL COORDINATION
      { rowId: '5307550842486660', category: 'GENERAL COORDINATION', discipline: 'Owner' },
      { rowId: '2127129975717764', category: 'GENERAL COORDINATION', discipline: 'Owner' },
      { rowId: '5859901816045444', category: 'GENERAL COORDINATION', discipline: 'Owner' },
      { rowId: '547927677730692', category: 'GENERAL COORDINATION', discipline: 'Design Team' },
      { rowId: '5379744328187780', category: 'GENERAL COORDINATION', discipline: 'Design Team' },
      { rowId: '4895423607734148', category: 'GENERAL COORDINATION', discipline: 'Design Team' },
      { rowId: '5541456289333124', category: 'GENERAL COORDINATION', discipline: 'Design Team' },
      { rowId: '7206525803691908', category: 'GENERAL COORDINATION', discipline: 'Design Team' },
      // SCHEDULE (5) - Category=SCHEDULE
      { rowId: '7070032121692036', category: 'SCHEDULE', discipline: 'Master Schedule' },
      { rowId: '3956223781764996', category: 'SCHEDULE', discipline: 'Master Schedule' },
      { rowId: '832613142495108', category: 'SCHEDULE', discipline: 'Master Schedule' },
      { rowId: '2943152665788292', category: 'SCHEDULE', discipline: 'Design Schedule' },
      { rowId: '4942959802449796', category: 'SCHEDULE', discipline: 'Design Schedule' },
      // PROCUREMENT (4) - Category=PROCUREMENT
      { rowId: '6583284551778180', category: 'PROCUREMENT', discipline: 'CM Selection' },
      { rowId: '4186307327295364', category: 'PROCUREMENT', discipline: 'Trade Buyout' },
      { rowId: '2620864259030916', category: 'PROCUREMENT', discipline: 'Trade Buyout' },
      { rowId: '4500923152465796', category: 'PROCUREMENT', discipline: 'FF&E' },
      // DESIGN & PLANS (3) - Category=DESIGN & PLANS
      { rowId: '3003095729176452', category: 'DESIGN & PLANS', discipline: 'Architecture' },
      { rowId: '909089301987204', category: 'DESIGN & PLANS', discipline: 'Architecture' },
      { rowId: '2161543132741508', category: 'DESIGN & PLANS', discipline: 'Architecture' },
      // LEGAL & CONTRACTS (3) - Category=LEGAL & CONTRACTS
      { rowId: '3574945466023812', category: 'LEGAL & CONTRACTS', discipline: 'Construction Agreements' },
      { rowId: '4042678252208004', category: 'LEGAL & CONTRACTS', discipline: 'Design Agreements' },
      { rowId: '209127772520324', category: 'LEGAL & CONTRACTS', discipline: 'Development Agreement' },
      // UTILITIES & INFRASTRUCTURE (2) - Category=UTILITIES & INFRASTRUCTURE
      { rowId: '4214233204653956', category: 'UTILITIES & INFRASTRUCTURE', discipline: 'Power (SMUD)' },
      { rowId: '7429307367948164', category: 'UTILITIES & INFRASTRUCTURE', discipline: '' }, // blank - doesn't fit single utility
    ];

    const updateBatches = [];
    for (const cls of classifications) {
      const cells = [];
      if (cls.category) cells.push({ columnId: CATEGORY_COL, objectValue: { displayValue: cls.category } });
      if (cls.discipline) cells.push({ columnId: DISCIPLINE_COL, objectValue: { displayValue: cls.discipline } });
      updateBatches.push({ id: cls.rowId, cells });
    }

    // Batch update classifications (Smartsheet allows up to 10,000 per batch)
    if (updateBatches.length > 0) {
      const classifyResult = await smartsheet.updateRows(DOVA, updateBatches);
      results.classification = { count: updateBatches.length, message: classifyResult.message || 'OK' };
    }

    // ── 2. DELETE 2 ROWS ── (idempotent — skip if already gone)
    const deleteIds = ['506023801126788', '5277077752905604'];
    try {
      const deleteResult = await smartsheet.deleteRows(DOVA, deleteIds);
      results.deletions = { deleted: deleteIds, message: deleteResult.message || 'OK' };
    } catch (e) {
      // Rows may already be deleted from a previous run
      results.deletions = { deleted: deleteIds, note: 'May already be deleted — ' + e.message };
    }

    // ── 3. HANDLE AMBIGUOUS ROW 7108958910676868 ──
    let ambiguousNote = 'Not checked';
    try {
      const ambRow = await smartsheet.getRow(DOVA, '7108958910676868');
      const cells = ambRow.cells || [];
      const allValues = cells.map(c => c.displayValue || c.value || '').filter(v => v);
      // Find a Notes/Source column specifically
      const notesCol = Object.values(cols).find(c => /note|source/i.test(c.title));
      let noteContent = '';
      if (notesCol) {
        const noteCell = cells.find(c => c.columnId === notesCol.id);
        noteContent = noteCell ? (noteCell.displayValue || noteCell.value || '') : '';
      }
      ambiguousNote = `Row 7108958910676868: Values=${allValues.join(' | ')}. Notes: ${noteContent}`;
      results.ambiguous = { rowId: '7108958910676868', note: ambiguousNote, action: 'Left in DOVA, needs flagging' };
    } catch (e) {
      results.ambiguous = { rowId: '7108958910676868', error: e.message, action: 'Row may not exist' };
    }

    // ── 4. MOVE 9 ROWS FROM DOVA TO MFP ──
    const moveRowIds = [
      '681604480106372',
      '1878666626334596',
      '8871184769351556',
      '6227519655772036',
      '1980685789822852',
      '6516512704298884',
      '217533263773572',
      '2283146245177220',
      '7061586198527876',
    ];

    const moveResults = [];
    for (const rowId of moveRowIds) {
      try {
        // Read from DOVA
        const row = await smartsheet.getRow(DOVA, rowId);
        const cells = row.cells || [];
        
        // Copy data to MFP — handle column type mapping
          const mfpCells = [];
          for (const cell of cells) {
            const dovaCol = (sheet.columns || []).find(c => c.id === cell.columnId);
            if (!dovaCol) continue;
            const mfpCol = mfpCols[dovaCol.title];
            if (!mfpCol) continue;

            // Get the value in the right format
            let rawValue;
            if (dovaCol.type === 'MULTI_PICKLIST' || dovaCol.type === 'PICKLIST' || dovaCol.type === 'DATE' || dovaCol.type === 'ABSTRACT_DATETIME') {
              rawValue = cell.displayValue || '';
            } else if (typeof cell.value === 'object' && cell.value !== null) {
              rawValue = cell.displayValue || JSON.stringify(cell.value);
            } else {
              rawValue = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
            }
            if (!rawValue || rawValue === '' || rawValue === 'null' || rawValue === 'undefined') continue;

            // Smartsheet: MULTI_PICKLIST and PICKLIST both need objectValue in addRow
                        mfpCells.push({ columnId: mfpCol.id, objectValue: { displayValue: String(rawValue) } });
          }

        if (mfpCells.length === 0) {
          moveResults.push({ rowId, error: 'No mappable cells found', dovaRowCells: cells.map(c => ({ colId: c.columnId, type: (sheet.columns||[]).find(x=>x.id===c.columnId)?.type, val: typeof c.value, disp: c.displayValue })) });
          continue;
        }

        // Add to MFP — log the payload for debugging
        const addPayload = { cells: mfpCells, toBottom: true };
        if (rowId === moveRowIds[0]) {
          results.debugAddPayload = mfpCells.map(c => ({ colId: c.columnId, useObj: !!c.objectValue, useVal: !!c.value, valPreview: c.objectValue?.displayValue?.substring(0,30) || (typeof c.value === 'string' ? c.value.substring(0,30) : String(c.value||'').substring(0,30)) }));
        }
        await smartsheet.addRow(MFP, mfpCells);
        
        // Delete from DOVA
        await smartsheet.deleteRows(DOVA, rowId);
        
        moveResults.push({ rowId, status: 'moved' });
      } catch (e) {
        moveResults.push({ rowId, error: e.message });
      }
    }
    results.moves = moveResults;

    // ── 5. SET PROJECT="Business" ON 2 ROWS ──
    const bizRows = ['2987527324172164', '900418000912260'];
    const bizUpdates = bizRows.map(rowId => ({
      id: rowId,
      cells: [{ columnId: PROJECT_COL, value: 'Business' }]
    }));
    const bizResult = await smartsheet.updateRows(DOVA, bizUpdates);
    results.businessProject = { rows: bizRows, message: bizResult.message || 'OK' };

    return res.json({ success: true, results });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}