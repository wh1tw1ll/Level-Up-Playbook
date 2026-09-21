// api/idempotency.js — Idempotency key helpers
import { createHash } from 'crypto';

export function makeKey(source, subject, date) {
  const raw = [source || '', subject || '', date || ''].join('|').toLowerCase().trim();
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export async function checkIdempotent(smartsheet, sheetId, extractionKey) {
  if (!extractionKey) return false;
  // Fetch sheet to check for existing key
  const sheet = await smartsheet.getSheet(sheetId);
  const cols = sheet.columns || [];
  const ekCol = cols.find(c => c.title === 'ExtractionId');
  if (!ekCol) return false; // Column doesn't exist yet — skip check
  const rows = sheet.rows || [];
  for (const row of rows) {
    const cell = (row.cells || []).find(c => c.columnId === ekCol.id);
    if (cell && (cell.value || cell.displayValue) === extractionKey) return true; // already exists
  }
  return false;
}