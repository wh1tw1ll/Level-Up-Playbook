export default async function handler(req, res) {
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'no token' });

  try {
    const r = await fetch(
      'https://api.smartsheet.com/2.0/sheets/2802755367554948?include=objectValue',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const d = await r.text();
    res.json({
      status: r.status,
      body: d.substring(0, 500)
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}