// Compare column types between working sheets and empty ones
// Read-only diagnostic tool. Uses smartsheet.js wrapper.

import smartsheet from '../smartsheet.js';

export default async function handler(req, res) {
  const checks = {
    "01_working": 6056924725333892,
    "02_empty": 2990378205532036,
    "03_empty": 6150202825068420,
    "04_working": 7416565342359428
  };

  const r = {};
  for (const [key, id] of Object.entries(checks)) {
    try {
      const s = await smartsheet.getSheetWithColumns(id);
      r[key] = {
        name: s.name,
        rows: (s.rows || []).length,
        columns: (s.columns || []).map(c => ({
          id: c.id,
          index: c.index,
          title: c.title,
          type: c.type,
          options: c.options || [],
          format: c.format,
          symbol: c.symbol,
          validation: c.validation || null,
          width: c.width
        }))
      };
    } catch (e) {
      r[key] = { error: e.message };
    }
  }

  res.json(r);
}