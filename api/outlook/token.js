// api/outlook/token.js — shared token refresh utility for all Outlook API endpoints
// Uses the refresh_token stored in lu_auth cookie (tiny ~200B) to get fresh access tokens

export async function refreshTokenIfNeeded(tokenData, clientId, clientSecret, tenantId) {
  // tokenData should have: { refresh_token, name, email, expires_at }
  if (!tokenData || !tokenData.refresh_token) return null;

  // Always refresh — the cookie only has refresh_token, never a cached access_token
  // This keeps the cookie tiny (no 3KB JWT) and avoids size truncation on Vercel edge
  const r = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
      scope: 'openid profile email offline_access Files.Read.All Sites.Read.All Mail.Read Calendars.Read User.Read'
    })
  });
  const tokens = await r.json();
  if (tokens.error || !tokens.access_token) {
    console.error('Token refresh failed:', tokens.error, tokens.error_description?.slice(0, 200));
    return null;
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || tokenData.refresh_token,
    expires_at: Date.now() + 7*24*3600*1000, // extend session
    name: tokenData.name,
    email: tokenData.email
  };
}

export function parseCookies(req) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  });
  return cookies;
}

export function setAuthCookies(res, data) {
  const authPayload = JSON.stringify({
    refresh_token: data.refresh_token,
    name: data.name,
    email: data.email,
    expires_at: data.expires_at
  });
  const sessionPayload = JSON.stringify({ name: data.name, email: data.email, authenticated: true });
  res.setHeader('Set-Cookie', [
    `lu_auth=${encodeURIComponent(authPayload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7*24*3600}`,
    `lu_session=${encodeURIComponent(sessionPayload)}; Path=/; Secure; SameSite=Lax; Max-Age=${7*24*3600}`
  ]);
}

export function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    `lu_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `lu_session=; Path=/; Secure; SameSite=Lax; Max-Age=0`
  ]);
}

export function getTokenData(req) {
  const cookies = parseCookies(req);
  const enc = cookies['lu_auth'];
  if (!enc) return null;
  try { return JSON.parse(decodeURIComponent(enc)); }
  catch { return null; }
}
