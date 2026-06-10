// api/auth/me.js — check authentication via lu_session cookie
export default function handler(req, res) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  });

  // Check lu_session first (small, non-HttpOnly, readable by JS)
  const session = cookies['lu_session'];
  if (session) {
    try {
      const data = JSON.parse(decodeURIComponent(session));
      if (data.authenticated && data.name) {
        return res.json({ authenticated: true, name: data.name, email: data.email });
      }
    } catch(e) {}
  }

  // Fallback: check lu_auth (HttpOnly, only server can read)
  const enc = cookies['lu_auth'];
  if (enc) {
    try {
      const data = JSON.parse(decodeURIComponent(enc));
      if (data.refresh_token && data.name) {
        return res.json({ authenticated: true, name: data.name, email: data.email });
      }
    } catch(e) {}
  }

  return res.status(401).json({ authenticated: false, reason: 'not_authenticated' });
}