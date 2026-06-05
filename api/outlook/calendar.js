// api/outlook/calendar.js — standalone
export default async function handler(req, res) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) cookies[k.trim()]=v.join('=').trim(); });
  const enc = cookies['lu_auth'];
  if (!enc) return res.status(401).json({ error: 'Not authenticated' });
  let token;
  try { const d = JSON.parse(decodeURIComponent(enc)); if (Date.now() > d.expires_at) return res.status(401).json({ error: 'Expired' }); token = d.access_token; }
  catch { return res.status(401).json({ error: 'Invalid cookie' }); }

  const days = parseInt(req.query.days||'14');
  const now  = new Date().toISOString();
  const end  = new Date(Date.now() + days*86400000).toISOString();
  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${now}&endDateTime=${end}&$top=20&$select=subject,start,end,location,organizer,webLink,bodyPreview&$orderby=start/dateTime`,
      { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="Eastern Standard Time"' } }
    );
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
}
