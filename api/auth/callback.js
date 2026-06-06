// api/auth/callback.js
export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error) return res.redirect('/?auth_error=' + encodeURIComponent(error));
  if (!code)  return res.status(400).json({ error: 'No code' });

  const CLIENT_ID     = process.env.LU_CLIENT_ID;
  const CLIENT_SECRET = process.env.LU_CLIENT_SECRET;
  const TENANT_ID     = process.env.LU_TENANT_ID;
  const REDIRECT      = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
          code, redirect_uri: REDIRECT, grant_type: 'authorization_code',
        }),
      }
    );
    const tokens = await tokenRes.json();
    if (tokens.error) {
      console.error('Token error:', tokens);
      return res.redirect('/?auth_error=' + encodeURIComponent(tokens.error_description || tokens.error));
    }

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json();

    const expiresAt = Date.now() + ((tokens.expires_in || 3600) * 1000);
    const name = me.displayName || me.userPrincipalName || 'User';
    const email = me.mail || me.userPrincipalName || '';

    // Store full auth payload (with token) in HttpOnly cookie for server API calls
    const authPayload = JSON.stringify({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expires_at:    expiresAt,
      name, email,
    });

    // Store readable session info in second cookie for JS to detect auth state
    const sessionPayload = JSON.stringify({ name, email, expires_at: expiresAt });

    res.setHeader('Set-Cookie', [
      `lu_auth=${encodeURIComponent(authPayload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7*24*3600}`,
      `lu_session=${encodeURIComponent(sessionPayload)}; Path=/; Secure; SameSite=Lax; Max-Age=${7*24*3600}`
    ]);
    res.redirect('/?auth=success');
  } catch(err) {
    console.error('Callback error:', err);
    res.redirect('/?auth_error=server_error');
  }
}
