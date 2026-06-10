// api/auth/callback.js
// BUG FIX: Returns a 200 HTML page instead of a 302 redirect.
// Vercel's edge network does NOT reliably forward Set-Cookie headers on 30x
// responses. By returning a 200 with Set-Cookie (reliable on non-redirect)
// AND setting the JS-readable lu_session via document.cookie in the HTML,
// the cookies always arrive in the browser.
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
      console.error('Token exchange error:', tokens);
      const desc = tokens.error_description || tokens.error || 'Unknown error';
      console.error('Full token response:', JSON.stringify(tokens));
      return res.redirect('/?auth_error=' + encodeURIComponent(desc.substring(0, 300)));
    }

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json();
    const name = me.displayName || me.userPrincipalName || 'User';
    const email = me.mail || me.userPrincipalName || '';
    const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7-day session

    // Auth cookie (HttpOnly — for /auth/me and Graph API calls)
    const authPayload = JSON.stringify({
      refresh_token: tokens.refresh_token || '',
      name, email, expires_at: expiresAt
    });

    // Session cookie payload (JS-readable — for checkAuthFromCookie)
    // BUG FIX: Include expires_at so checkAuthFromCookie() validates it
    const sessionPayload = JSON.stringify({
      name, email, authenticated: true,
      expires_at: expiresAt
    });

    // Set the HttpOnly lu_auth cookie via Set-Cookie on a 200 response.
    // On a 200 (not 302), Vercel edge reliably forwards Set-Cookie headers.
    res.setHeader('Set-Cookie', [
      `lu_auth=${encodeURIComponent(authPayload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7*24*3600}`
    ]);

    // Return an HTML page that sets the JS-readable cookie and then redirects
    const sessionCookie = encodeURIComponent(sessionPayload);
    const redirectTarget = '/?auth=success';

    res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Signing in...</title>
<script>
  // BUG FIX: Set lu_session via JavaScript (immune to Vercel edge cookie stripping)
  document.cookie = "lu_session=${sessionCookie}; Path=/; Secure; SameSite=Lax; Max-Age=${7*24*3600}";
  window.location.replace("${redirectTarget}");
</script></head>
<body><p>Signing you in...</p></body>
</html>`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/?auth_error=server_error');
  }
}