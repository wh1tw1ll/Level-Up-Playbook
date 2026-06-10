// api/procore/auth/login.js — Redirect to Procore OAuth
export default function handler(req, res) {
  const CLIENT_ID = process.env.PROCORE_CLIENT_ID;
  const REDIRECT = process.env.PROCORE_REDIRECT_URI || 'https://level-up-playbook.vercel.app/procore/callback';

  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'PROCORE_CLIENT_ID not configured' });
  }

  const url = `https://login.procore.com/oauth/authorize`
    + `?client_id=${CLIENT_ID}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT)}`
    + `&response_type=code`;

  res.redirect(302, url);
}