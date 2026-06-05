// api/auth/me.js
export default function handler(req, res) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  });

  const enc = cookies['lu_auth'];
  if (!enc) return res.status(401).json({ authenticated: false, reason: 'no_cookie' });

  try {
    const data = JSON.parse(decodeURIComponent(enc));
    if (Date.now() > data.expires_at) {
      return res.status(401).json({ authenticated: false, reason: 'expired' });
    }
    return res.json({ authenticated: true, name: data.name, email: data.email });
  } catch(e) {
    return res.status(401).json({ authenticated: false, reason: 'parse_error' });
  }
}
