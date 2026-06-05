// api/sharepoint/search.js — standalone (no imports)
export default async function handler(req, res) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) cookies[k.trim()]=v.join('=').trim(); });
  const enc = cookies['lu_auth'];
  if (!enc) return res.status(401).json({ error: 'Not authenticated' });
  let token;
  try { const d = JSON.parse(decodeURIComponent(enc)); if (Date.now() > d.expires_at) return res.status(401).json({ error: 'Expired' }); token = d.access_token; }
  catch { return res.status(401).json({ error: 'Invalid cookie' }); }

  const query = req.query.q || req.query.query || '';
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/search/query', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ entityTypes:['driveItem'], query:{queryString:query}, from:0, size:10 }] }),
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
}
