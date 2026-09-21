// lib/handlers/add-column.js — One-shot: add ExtractionId column to DOVA tracker
import smartsheet from '../smartsheet.js';

const DOVA_SHEET = '4456864287772548';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // Get sheet to find column count and check if column already exists
    const sheet = await smartsheet.getSheetWithColumns(DOVA_SHEET);
    const existingCol = (sheet.columns || []).find(c => c.title === 'ExtractionId');
    if (existingCol) {
      return res.json({ status: 'already_exists', columnId: existingCol.id, message: 'ExtractionId column already exists' });
    }

    // Add column
    const payload = {
      title: 'ExtractionId',
      type: 'TEXT_NUMBER',
      index: 0, // First column
    };

    const result = await smartsheet.addColumn(DOVA_SHEET, payload);
    return res.json({ status: 'created', result });
  } catch (err) {
    console.error('Add-column error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}