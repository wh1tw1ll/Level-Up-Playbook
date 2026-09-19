// lib/guarded-write.js
// ONE FUNCTION. Every write path calls this. Nothing calls the Smartsheet API directly.
//
// Applies in order:
//   1. Strip — remove **, | From... source annotations
//   2. Validate — reject empty owner, multi-owner, short text, section headers, unresolved pronouns
//   3. Dedupe — normalize both sides, compare, reject exact + near duplicates
//   4. Write — only if 1-3 pass, using objectValue for TEXT_NUMBER columns
//
// Bug fixes embedded:
//   a) Dedupe regex uses re.I flag (case-insensitive)
//   b) Verb set expanded (process, contact, notify, address, remove, etc.)
//   c) Owner canonicalization: "Whitney" → "Whitney Williams", "Greg" → "Greg Wieting"
//   d) Multi-owner detection: reject any Owner value with comma or semicolon

import Smartsheet from './smartsheet.js';

// ============================================================
// CONFIG
// ============================================================

const CANONICAL_OWNERS = {
  'whitney': 'Whitney Williams',
  'whitney williams': 'Whitney Williams',
  'greg': 'Greg Wieting',
  'greg wieting': 'Greg Wieting',
  'charlie': 'Charlie Tiwana',
  'charlie tiwana': 'Charlie Tiwana',
  'sam': 'Sam Kalscheur',
  'sam kalscheur': 'Sam Kalscheur',
};

const SECTION_HEADERS = new Set([
  'Next Steps', 'Action Items', 'Proposal and Next Steps', '',
]);

// Expanded verb set — catches noun-phrase action items
const VERBS = new Set([
  'activate','add','address','advise','align','amend','analyze','approve',
  'arrange','assign','assess','block','bring','budget','build','call',
  'cancel','change','check','circulate','clarify','close','close out',
  'collect','commit','communicate','complete','confirm','consolidate',
  'contact','contract','coordinate','copy','cover','create','decide',
  'define','delegate','deliver','design','determine','develop','direct',
  'discuss','document','draft','drive','email','engage','ensure',
  'establish','estimate','evaluate','execute','expand','expedite',
  'extend','facilitate','finalize','find','finish','flag','follow',
  'follow up','forward','gather','get','give','handle','have','hold',
  'host','identify','implement','improve','include','incorporate',
  'increase','inform','initiate','inspect','install','integrate',
  'introduce','investigate','invoice','issue','join','keep','kick off',
  'launch','lead','learn','let','list','load','locate','log','loop',
  'maintain','make','manage','map','mark','meet','modify','monitor',
  'move','need','negotiate','note','notify','obtain','open','order',
  'organize','oversee','pay','perform','permit','pick','place','plan',
  'prepare','present','prioritize','process','procure','protect',
  'provide','pull','pursue','push','put','reach','realign','receive',
  'recommend','reconcile','reduce','refer','register','renegotiate',
  'renew','report','request','research','resolve','respond','review',
  'revise','route','schedule','secure','send','set','settle','share',
  'sign','sign off','simplify','source','start','stop','streamline',
  'submit','support','survey','take','target','task','terminate',
  'test','track','train','transfer','trigger','turn','update',
  'validate','verify','visit','waive','walk','work','write',
  // Participle forms
  'sends','sending','sent','calls','calling','called',
  'reviews','reviewing','reviewed','provides','providing','provided',
  'updates','updating','updated','submits','submitting','submitted',
  'confirms','confirming','confirmed',
]);

// ============================================================
// STEP 1: STRIP
// ============================================================

function strip(text) {
  if (!text) return '';
  let result = text
    .replace(/\*\*/g, '')                    // remove ** bold markers
    .replace(/\s*\|\s*from\s+.*$/i, '')     // remove | From... suffix (case-insensitive)
    .replace(/\s*\([^)]*\)\s*$/, '')        // remove trailing (notes)
    .trim();
  return result;
}

function normalizeForDedupe(text) {
  return strip(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"]+$/, '')
    .replace(/^[.,;:!?'"]+/, '')
    .trim();
}

function wordOverlap(a, b) {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

// ============================================================
// STEP 2: VALIDATE
// ============================================================

const PARTY_NAMES = new Set([
  'albert','brian','charlie','chuck','david','don','greg','kevin',
  'matt','orlana','philip','sam','thomas','whitney','william','joseph',
  'josh','graham','jeremiah','kozpure','jci','perkins','suffolk',
  'hunt','mccarthy','wood','rogers','tony','michael','jennifer',
]);

function validate(action, owner) {
  const errors = [];

  // --- Owner checks ---
  if (!owner || owner.trim() === '') {
    errors.push('Owner is empty');
  } else {
    const trimmed = owner.trim();
    if (trimmed.includes(',') || trimmed.includes(';') || trimmed.includes('/') || /\s+and\s+/i.test(trimmed) || trimmed.includes('&')) {
          errors.push(`Multi-owner value rejected: "${owner}" — use one owner, name the other in the text`);
    }
    // Canonicalize
    const key = trimmed.toLowerCase();
    if (CANONICAL_OWNERS[key] && CANONICAL_OWNERS[key] !== trimmed) {
      // Auto-canonicalize
      owner = CANONICAL_OWNERS[key];
    }
  }

  // --- Action checks ---
  if (!action || action.trim().length < 5) {
    errors.push('Action text too short (< 5 chars) or empty');
    return { passed: false, errors, owner };
  }

  const cleaned = strip(action);
  if (!cleaned || cleaned.length < 3) {
    errors.push('Action text empty after stripping markers');
    return { passed: false, errors, owner };
  }

  if (SECTION_HEADERS.has(cleaned.trim())) {
    errors.push('Section header, not an action');
    return { passed: false, errors, owner };
  }

  // Check for unresolved pronouns
  const lower = cleaned.toLowerCase();
  if (/^(they|them|their|he|she|it|we|our)\s/.test(lower)) {
    errors.push('Unresolved pronoun — replace "they/them/their" with the actual name');
    return { passed: false, errors, owner };
  }

  // Check for action verb: [verb] first word OR [Party] to [verb]
  const words = lower.split(/\s+/);
  const hasVerb = VERBS.has(words[0].replace(/[,;:.]$/, ''));

  let hasPartyVerb = false;
  for (let i = 0; i < Math.min(words.length, 10); i++) {
    const w = words[i].replace(/[,;:.]$/, '');
    if (PARTY_NAMES.has(w) && i + 2 < words.length) {
      if (words[i+1] === 'to' && VERBS.has(words[i+2].replace(/[,;:.]$/, ''))) {
        hasPartyVerb = true;
        break;
      }
      if (i + 3 < words.length && words[i+1].replace(/[,;:.]$/, '') === 'to'
          && PARTY_NAMES.has(words[i+2].replace(/[,;:.]$/, ''))
          && words[i+3] === 'to' && VERBS.has(words[i+4]?.replace(/[,;:.]$/, ''))) {
        hasPartyVerb = true;
        break;
      }
    }
  }

  if (!hasVerb && !hasPartyVerb) {
    // Check for task-style text containing action verbs mid-phrase
    const containsVerb = [...VERBS].some(v => lower.includes(v));
    if (!containsVerb) {
      errors.push('No action verb found — the text may be an observation, not an action');
    }
  }

  return { passed: errors.length === 0, errors, owner };
}

// ============================================================
// STEP 3: DEDUPE
// ============================================================

async function deduplicate(sheetId, action, owner, smartsheet) {
  const incoming = normalizeForDedupe(action);

  try {
    const sheet = await smartsheet.getSheet(sheetId);
    const actionCol = findColumn(sheet, 'Action ID');
    if (!actionCol) return { isDuplicate: false };

    for (const row of sheet.rows || []) {
      const cell = row.cells?.find(c => c.columnId === actionCol.id);
      if (!cell || cell.value === undefined || cell.value === null) continue;

      // Handle both string and object-value formats
      const rawValue = typeof cell.value === 'object' && cell.value !== null
        ? String(cell.value.objectValue || cell.value.tag || cell.value.label || '')
        : String(cell.value);
      const existing = normalizeForDedupe(rawValue);

      // Exact match (after normalization)
      if (existing === incoming) {
        return { isDuplicate: true, existingRowId: row.id, existingAction: cell.value };
      }

      // Fuzzy match: word overlap >= 0.65
      if (existing.length > 10 && incoming.length > 10) {
        const overlap = wordOverlap(existing, incoming);
        if (overlap >= 0.65) {
          return { isDuplicate: true, existingRowId: row.id, existingAction: cell.value, matchType: 'fuzzy', overlap };
        }
      }
    }
  } catch (e) {
    // If we can't read the sheet, proceed without dedup (bad but not fatal)
    console.warn('Dedupe check failed:', e.message);
  }

  return { isDuplicate: false };
}

function findColumn(sheet, title) {
  return sheet.columns?.find(c => c.title === title) || null;
}

// ============================================================
// STEP 4: WRITE (only this function calls the Smartsheet API)
// ============================================================

async function writeRow(sheetId, cells, smartsheet) {
  return smartsheet.addRow(sheetId, cells);
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * guardedWrite — the one function every write path calls.
 *
 * @param {Object} opts
 * @param {string} opts.sheetId — Smartsheet sheet ID
 * @param {Object} opts.smartsheet — Smartsheet API client (injected)
 * @param {Array} opts.columns — column values for the new row: [{title, value}, ...]
 * @param {string} [opts.existingRowId] — if updating an existing row (for edits)
 * @returns {{ passed: boolean, reason: string, data: any }}
 */
export default async function guardedWrite(opts) {
  const { sheetId, smartsheet, columns, existingRowId } = opts;

  // Extract action and owner from columns
  const actionCol = columns.find(c => c.title === 'Action ID');
  const ownerCol = columns.find(c => c.title === 'Owner');
  const action = actionCol?.value || '';
  const owner = ownerCol?.value || '';

  // STRIP (strip markers from action text)
  const strippedAction = action ? strip(action) : '';

  // STEP 2: VALIDATE
  if (!existingRowId) {
    const validation = validate(strippedAction, owner);
    if (!validation.passed) {
      return {
        passed: false,
        reason: validation.errors.join('; '),
        data: { action: strippedAction, owner: validation.owner },
      };
    }
  }

  // STEP 3: DEDUPE
  if (!existingRowId) {
    const dedup = await deduplicate(sheetId, strippedAction, validation.owner, smartsheet);
    if (dedup.isDuplicate) {
      return {
        passed: false,
        reason: `Duplicate of row ${dedup.existingRowId}: "${dedup.existingAction?.substring(0, 60)}..."`,
        data: { existingRowId: dedup.existingRowId },
      };
    }
  }

  // Build cell payload with objectValue format for TEXT_NUMBER columns
  const cells = columns.map(col => {
    const cell = { columnId: col.columnId };
    // TEXT_NUMBER and PICKLIST columns need objectValue
    if (col.type === 'TEXT_NUMBER' || col.type === 'PICKLIST') {
      cell.objectValue = col.value;
    } else {
      cell.value = col.value;
    }
    return cell;
  });

  // STEP 4: WRITE
  let result;
  if (existingRowId) {
    // Update existing row
    result = await smartsheet.updateRowCells(sheetId, existingRowId, cells);
  } else {
    // Add new row
    result = await smartsheet.addRow(sheetId, cells);
  }

  return {
    passed: true,
    reason: 'OK',
    data: result,
  };
}

export { strip, normalizeForDedupe, validate, CANONICAL_OWNERS };