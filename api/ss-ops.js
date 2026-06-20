// Compare column types between working sheets and empty ones
export default async function handler(req, res) {
  const token = process.env.SMARTSHEET_TOKEN || '';
  
  // Check a sheet WITH data (01 - Budget) vs WITHOUT (02 - Schedule)
  const checks = {
    "01_working": 6056924725333892,
    "02_empty": 2990378205532036,
    "03_empty": 6150202825068420,
    "04_working": 7416565342359428
  };
  
  const r = {};
  for (const [key, id] of Object.entries(checks)) {
    const s = await (await fetch(`https://api.smartsheet.com/2.0/sheets/${id}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    })).json();
    
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
      })),
      // Show first existing row's raw cell data
      firstRow: (s.rows || [])[0] ? (s.rows[0].cells || []).map(c => ({
        columnId: c.columnId,
        columnType: c.type,
        value: c.value,
        displayValue: c.displayValue
      })) : 'no rows'
    };
  }

  res.json(r);
}

export const config = { maxDuration: 30 };