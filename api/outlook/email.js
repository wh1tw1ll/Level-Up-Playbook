// api/outlook/email.js — standalone
export default async function handler(req, res) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) cookies[k.trim()]=v.join('=').trim(); });
  const enc = cookies['lu_auth'];
  if (!enc) return res.status(401).json({ error: 'Not authenticated' });
  let token;
  try { const d = JSON.parse(decodeURIComponent(enc)); if (Date.now() > d.expires_at) return res.status(401).json({ error: 'Expired' }); token = d.access_token; }
  catch { return res.status(401).json({ error: 'Invalid cookie' }); }

  const limit = Math.min(parseInt(req.query.limit||'20'), 50);
  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$select=subject,from,receivedDateTime,bodyPreview,isRead,webLink&$orderby=receivedDateTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
}
