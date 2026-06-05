// api/auth/me.js — returns current user info from cookie
export default function handler(req, res) {
  // Vercel doesn't auto-parse cookies — read the Cookie header manually
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map((p, i) => i === 0 ? p : p))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k.trim(), v.join('=').trim()])
  );
  const cookie = cookies['lu_auth'];

  if (!cookie) {
    return res.status(401).json({ authenticated: false, reason: 'no_cookie' });
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
  } catch(e) {
    res.status(401).json({ authenticated: false, reason: 'invalid' });
  }
}
