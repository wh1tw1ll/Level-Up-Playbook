// api/auth/login.js
export default function handler(req, res) {
  const CLIENT_ID  = process.env.LU_CLIENT_ID;
  const TENANT_ID  = process.env.LU_TENANT_ID;
  const REDIRECT   = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';

  const scopes = [
      'openid','profile','email','offline_access','User.Read'
    ].join(' ');

  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`
    + `?client_id=${CLIENT_ID}`
    + `&response_type=code`
    + `&redirect_uri=${encodeURIComponent(REDIRECT)}`
    + `&scope=${encodeURIComponent(scopes)}`
    + `&response_mode=query`
    + `&prompt=select_account`;

  res.redirect(302, url);
}
