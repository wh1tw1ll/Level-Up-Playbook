// api/auth/me.js — returns current user info from cookie
export default function handler(req, res) {
  const cookie = req.cookies?.lu_auth;
  if (!cookie) {
    return res.status(401).json({ authenticated: false });
  }
  try {
    const data = JSON.parse(decodeURIComponent(cookie));
    if (Date.now() > data.expires_at) {
      return res.status(401).json({ authenticated: false, reason: 'expired' });
    }
    res.json({
      authenticated: true,
      name: data.name,
      email: data.email,
      expires_at: data.expires_at,
    });
  } catch {
    res.status(401).json({ authenticated: false, reason: 'invalid' });
  }
}
