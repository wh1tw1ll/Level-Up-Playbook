// api/auth/login.js — redirects user to Microsoft login
export default function handler(req, res) {
  const CLIENT_ID = process.env.LU_CLIENT_ID;
  const TENANT_ID = process.env.LU_TENANT_ID;
  const REDIRECT_URI = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';

  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'Files.Read.All',
    'Sites.Read.All',
    'Mail.Read',
    'Calendars.Read',
    'User.Read',
  ].join(' ');

  const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`
    + `?client_id=${CLIENT_ID}`
    + `&response_type=code`
    + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    + `&scope=${encodeURIComponent(scopes)}`
    + `&response_mode=query`
    + `&prompt=select_account`;

  res.redirect(302, authUrl);
}
