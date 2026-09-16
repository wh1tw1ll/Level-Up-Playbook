// One-shot: add SeriesMasterId column to the Project sheet
export default async function handler(req, res) {
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not set' });

  const SHEET_ID = '4456864287772548';
  const COLUMN_TITLE = 'SeriesMasterId';
  const COLUMN_TYPE = 'TEXT_NUMBER';

  // Check if column already exists
  const sheet = await (await fetch(`https://api.smartsheet.com/2.0/sheets/${SHEET_ID}`, {
    headers: { Authorization: 'Bearer ' + token }
  })).json();

  const existing = (sheet.columns || []).find(c => c.title === COLUMN_TITLE);
  if (existing) {
    return res.json({ status: 'exists', column: existing });
  }

  // Add the column
  const addResp = await fetch(`https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/columns`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: COLUMN_TITLE,
      type: COLUMN_TYPE,
      index: 0
    })
  });

  const addData = await addResp.json();
  if (!addResp.ok) {
    return res.status(502).json({ error: 'Failed to add column', detail: addData });
  }

  // Also add to Personal sheet
  const PERSONAL_SHEET = '2802755367554948';
  const personalSheet = await (await fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}`, {
    headers: { Authorization: 'Bearer ' + token }
  })).json();

  const personalExisting = (personalSheet.columns || []).find(c => c.title === COLUMN_TITLE);
  if (!personalExisting) {
    await fetch(`https://api.smartsheet.com/2.0/sheets/${PERSONAL_SHEET}/columns`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: COLUMN_TITLE,
        type: COLUMN_TYPE,
        index: 0
      })
    });
  }

  return res.json({ status: 'created', column: addData });
}