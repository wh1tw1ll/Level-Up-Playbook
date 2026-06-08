// api/verify-password.js
// Checks a shared team password against a Vercel env variable.
// Sets a session cookie on success so users don't re-enter.

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
  const password = String(body.password || '').trim();

  const expected = process.env.SITE_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: 'SITE_PASSWORD not configured' });
  }

  if (password !== expected) {
    return res.status(401).json({ valid: false, error: 'Incorrect password' });
  }

  // Set session cookie — expires in 24 hours
  const cookieValue = encodeURIComponent(JSON.stringify({
    authed: true,
    ts: Date.now(),
    expires_at: Date.now() + 24 * 60 * 60 * 1000
  }));

  res.setHeader('Set-Cookie', `lu_site_auth=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}`);
  return res.status(200).json({ valid: true });
}