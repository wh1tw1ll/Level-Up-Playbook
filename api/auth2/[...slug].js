// api/auth2/[...slug].js — combined auth handler for /auth/login, /auth/callback, /auth/me, /auth/logout
// Single file to stay under Vercel Hobby's 12-function limit.

function parseCookies(req) {
  var raw = req.headers['cookie'] || '';
  var cookies = {};
  raw.split(';').forEach(function(p) {
    var parts = p.trim().split('=');
    if (parts[0]) cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
  });
  return cookies;
}

// ─── LOGIN ─────────────────────────────────────────────────────────
async function handleLogin(req, res) {
  var CLIENT_ID = process.env.LU_CLIENT_ID;
  var TENANT_ID = process.env.LU_TENANT_ID;
  var REDIRECT = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';
  if (!CLIENT_ID || !TENANT_ID) return res.status(500).json({ error: 'Auth not configured' });
  var scopes = ['openid','profile','email','offline_access','User.Read','Calendars.Read','Calendars.Read.Shared'].join(' ');
  var url = 'https://login.microsoftonline.com/' + TENANT_ID + '/oauth2/v2.0/authorize'
    + '?client_id=' + CLIENT_ID
    + '&response_type=code'
    + '&redirect_uri=' + encodeURIComponent(REDIRECT)
    + '&scope=' + encodeURIComponent(scopes)
    + '&response_mode=query'
    + '&prompt=login';
  res.redirect(302, url);
}

// ─── CALLBACK ─────────────────────────────────────────────────────
async function handleCallback(req, res) {
  var { code, error } = req.query;
  if (error) return res.redirect('/?auth_error=' + encodeURIComponent(error));
  if (!code) return res.status(400).json({ error: 'No code' });

  var CLIENT_ID = process.env.LU_CLIENT_ID;
  var CS = process.env.LU_CLIENT_SECRET;
  var TENANT_ID = process.env.LU_TENANT_ID;
  var REDIRECT = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';
  if (!CLIENT_ID || !CS || !TENANT_ID) return res.status(500).json({ error: 'Auth not configured' });

  try {
    var tokenRes = await fetch('https://login.microsoftonline.com/' + TENANT_ID + '/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CS, code, redirect_uri: REDIRECT, grant_type: 'authorization_code'
      })
    });
    var tokens = await tokenRes.json();
    if (tokens.error) {
      console.error('Token exchange error:', tokens);
      return res.redirect('/?auth_error=' + encodeURIComponent((tokens.error_description || tokens.error || 'Unknown').substring(0, 300)));
    }

    var meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    var me = await meRes.json();
    var name = me.displayName || me.userPrincipalName || 'User';
    var email = me.mail || me.userPrincipalName || '';
    var expiresAt = Date.now() + 7 * 24 * 3600 * 1000;

    var authPayload = JSON.stringify({
      refresh_token: tokens.refresh_token || '', name, email, expires_at: expiresAt
    });
    var sessionPayload = JSON.stringify({
      name, email, authenticated: true, expires_at: expiresAt
    });

    // Set HttpOnly cookie on 200 response (not 302 — Vercel edge drops cookies on redirects)
    res.setHeader('Set-Cookie', [
      'lu_auth=' + encodeURIComponent(authPayload) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (7*24*3600)
    ]);

    // HTML page sets lu_session via JS (immune to edge stripping), then redirects
    var sessionCookie = encodeURIComponent(sessionPayload);
    // Invisible HTML: sets cookie via JS then redirects instantly — no flash page
    res.status(200).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>...</title><style>body{background:#0e1419;min-height:100vh}</style><script>document.cookie="lu_session=' + sessionCookie + '; Path=/; Secure; SameSite=Lax; Max-Age=' + (7*24*3600) + '";window.location.replace("/?auth=success");</script></head><body></body></html>');
  } catch(err) {
    console.error('Callback error:', err);
    res.redirect('/?auth_error=server_error');
  }
}

// ─── ME ────────────────────────────────────────────────────────────
function handleMe(req, res) {
  var cookies = parseCookies(req);
  var session = cookies['lu_session'];
  if (session) {
    try {
      var data = JSON.parse(decodeURIComponent(session));
      if (data.authenticated && data.name) {
        return res.json({ authenticated: true, name: data.name, email: data.email });
      }
    } catch(e) {}
  }
  var enc = cookies['lu_auth'];
  if (enc) {
    try {
      var data = JSON.parse(decodeURIComponent(enc));
      if (data.refresh_token && data.name) {
        return res.json({ authenticated: true, name: data.name, email: data.email });
      }
    } catch(e) {}
  }
  return res.status(401).json({ authenticated: false, reason: 'not_authenticated' });
}

// ─── LOGOUT ────────────────────────────────────────────────────────
function handleLogout(req, res) {
  res.setHeader('Set-Cookie', [
    'lu_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'lu_session=; Path=/; Secure; SameSite=Lax; Max-Age=0'
  ]);
  res.redirect('/');
}

// ─── ROUTER ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  var slug = (req.query.slug || []).join('/');
  if (slug === 'login') return handleLogin(req, res);
  if (slug === 'callback') return handleCallback(req, res);
  if (slug === 'me') return handleMe(req, res);
  if (slug === 'logout') return handleLogout(req, res);
  res.status(404).json({ error: 'Unknown auth endpoint' });
}