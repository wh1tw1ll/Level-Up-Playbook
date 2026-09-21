// lib/idempotency.js — ExtractionId key creation and duplicate detection
// Prevents duplicate row creation from re-running extraction pipelines

import crypto from 'crypto';

/**
 * Create a deterministic extraction key from source data.
 * Combines sourceRef, actionId text, and dueDate to produce a stable hash.
 */
export function makeKey(sourceRef, actionId, dueDate) {
  const raw = [sourceRef || '', actionId || '', dueDate || ''].join('::');
  if (!raw.replace(/::/g, '').trim()) return null; // all empty
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/**
 * Check if a row with the given extraction key already exists in the sheet.
 * Queries the ExtractionId column for a match.
 */
export async function checkIdempotent(smartsheet, sheetId, extractionKey) {
  if (!extractionKey) return false;

  try {
    const sheet = await smartsheet.getSheetWithColumns(sheetId);
    const ekCol = (sheet.columns || []).find(c => c.title === 'ExtractionId');
    if (!ekCol) return false; // column doesn't exist yet — can't check

    const rows = sheet.rows || [];
    return rows.some(row => {
      const cell = (row.cells || []).find(c => c.columnId === ekCol.id);
      return cell && String(cell.value).trim() === String(extractionKey).trim();
    });
  } catch (err) {
    console.error('Idempotency check error:', err.message);
    return false; // fail open — let the write proceed rather than block on error
  }
}