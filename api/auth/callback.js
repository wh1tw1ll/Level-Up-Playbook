// api/auth/callback.js — exchanges code for tokens, stores in cookie
export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?auth_error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  const CLIENT_ID     = process.env.LU_CLIENT_ID;
  const CLIENT_SECRET = process.env.LU_CLIENT_SECRET;
  const TENANT_ID     = process.env.LU_TENANT_ID;
  const REDIRECT_URI  = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri:  REDIRECT_URI,
          grant_type:    'authorization_code',
        }),
      }
    );

    const tokens = await tokenRes.json();

    if (tokens.error) {
      return res.redirect('/?auth_error=' + encodeURIComponent(tokens.error_description));
    }

    // Get user info
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json();

    // Store tokens in HttpOnly cookie (7 day expiry)
    const cookieVal = JSON.stringify({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    Date.now() + (tokens.expires_in * 1000),
      name:          me.displayName || me.mail,
      email:         me.mail || me.userPrincipalName,
    });

    const maxAge = 7 * 24 * 60 * 60; // 7 days
    res.setHeader('Set-Cookie',
      `lu_auth=${encodeURIComponent(cookieVal)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
    );

    res.redirect('/?auth=success');
  } catch (err) {
    console.error('Auth callback error:', err);
    res.redirect('/?auth_error=server_error');
  }
}
