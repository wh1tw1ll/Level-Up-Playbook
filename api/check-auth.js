// api/check-auth.js
// Returns whether the user has a valid site password session cookie.
// Used on page load to skip the password prompt.

export default function handler(req, res) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  });

  const enc = cookies['lu_site_auth'];
  if (!enc) return res.status(200).json({ authed: false });

  try {
    const data = JSON.parse(decodeURIComponent(enc));
    if (Date.now() > data.expires_at) {
      return res.status(200).json({ authed: false });
    }
    return res.status(200).json({ authed: true });
  } catch(e) {
    return res.status(200).json({ authed: false });
  }
}