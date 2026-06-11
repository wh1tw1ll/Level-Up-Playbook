// lib/auth.js — Shared OAuth/Graph utilities for all API handlers
// Eliminates 30+ lines of copy-paste from 8 separate handler files

const TENANT_ID = () => process.env.LU_TENANT_ID;
const CLIENT_ID = () => process.env.LU_CLIENT_ID;
const CLIENT_SECRET = () => process.env.LU_CLIENT_SECRET;

/**
 * Exchange a refresh token for fresh Graph access + refresh tokens.
 * Returns { access_token, refresh_token, name, email } or null.
 */
export async function getAccessToken(tokenData, extraScope = '') {
  if (!tokenData || !tokenData.refresh_token) return null;
  const baseScope = 'openid profile email offline_access Files.Read.All Sites.Read.All Mail.Read Calendars.Read User.Read';
  const scope = extraScope ? `${baseScope} ${extraScope}` : baseScope;
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
      scope
    })
  });
  const tokens = await r.json();
  if (tokens.error || !tokens.access_token) return null;
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || tokenData.refresh_token,
    name: tokenData.name,
    email: tokenData.email
  };
}

/**
 * Parse cookies from request header into an object.
 */
export function parseCookies(req) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  });
  return cookies;
}

/**
 * Clear lu_auth and lu_session cookies (logout).
 */
export function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    'lu_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'lu_session=; Path=/; Secure; SameSite=Lax; Max-Age=0'
  ]);
}

/**
 * Write refresh + session cookies from token data.
 */
export function writeRefreshCookies(res, data) {
  const authPayload = JSON.stringify({
    refresh_token: data.refresh_token,
    name: data.name,
    email: data.email,
    expires_at: Date.now() + 7 * 24 * 3600 * 1000
  });
  const sessionPayload = JSON.stringify({
    name: data.name,
    email: data.email,
    authenticated: true
  });
  res.setHeader('Set-Cookie', [
    `lu_auth=${encodeURIComponent(authPayload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
    `lu_session=${encodeURIComponent(sessionPayload)}; Path=/; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
  ]);
}

/**
 * Authenticate request from cookie. Returns tokenData or sends 401 and returns null.
 */
export async function authenticateRequest(req, res, extraScope = '') {
  const cookies = parseCookies(req);
  const enc = cookies['lu_auth'];
  if (!enc) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  let tokenData;
  try {
    tokenData = JSON.parse(decodeURIComponent(enc));
  } catch {
    res.status(401).json({ error: 'Invalid cookie' });
    return null;
  }
  const fresh = await getAccessToken(tokenData, extraScope);
  if (!fresh) {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Session expired' });
    return null;
  }
  writeRefreshCookies(res, fresh);
  return fresh;
}

/**
 * Wrap a handler that needs Graph auth. Calls authenticateRequest,
 * then passes { fresh, cookies } to the inner handler.
 */
export function withGraphAuth(innerHandler, extraScope = '') {
  return async (req, res) => {
    const fresh = await authenticateRequest(req, res, extraScope);
    if (!fresh) return;
    return innerHandler(req, res, fresh);
  };
}

/**
 * Standard CORS headers helper.
 */
export function setCors(res, origin = '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

/**
 * Handle OPTIONS preflight.
 */
export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}