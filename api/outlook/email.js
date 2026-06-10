// api/outlook/email.js — fetches recent emails using refresh-only cookie
async function getAccessToken(tokenData) {
  if (!tokenData || !tokenData.refresh_token) return null;
  const TENANT_ID = process.env.LU_TENANT_ID;
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.LU_CLIENT_ID,
      client_secret: process.env.LU_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
      scope: 'openid profile email offline_access Files.Read.All Sites.Read.All Mail.Read Calendars.Read User.Read'
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

function parseCookies(req) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) cookies[k.trim()]=v.join('=').trim(); });
  return cookies;
}

function writeRefreshCookies(res, data) {
  const authPayload = JSON.stringify({
    refresh_token: data.refresh_token,
    name: data.name,
    email: data.email,
    expires_at: Date.now() + 7*24*3600*1000
  });
  const sessionPayload = JSON.stringify({ name: data.name, email: data.email, authenticated: true });
  res.setHeader('Set-Cookie', [
    `lu_auth=${encodeURIComponent(authPayload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7*24*3600}`,
    `lu_session=${encodeURIComponent(sessionPayload)}; Path=/; Secure; SameSite=Lax; Max-Age=${7*24*3600}`
  ]);
}

export default async function handler(req, res) {
  const cookies = parseCookies(req);
  const enc = cookies['lu_auth'];
  if (!enc) return res.status(401).json({ error: 'Not authenticated' });

  let tokenData;
  try { tokenData = JSON.parse(decodeURIComponent(enc)); }
  catch { return res.status(401).json({ error: 'Invalid cookie' }); }

  const fresh = await getAccessToken(tokenData);
  if (!fresh) return res.status(401).json({ error: 'Session expired' });
  writeRefreshCookies(res, fresh);

  const limit = Math.min(parseInt(req.query.limit||'20'), 50);
  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$select=subject,from,receivedDateTime,bodyPreview,isRead,webLink&$orderby=receivedDateTime desc`,
      { headers: { Authorization: `Bearer ${fresh.access_token}` } }
    );
    if (!r.ok) {
      const errText = await r.text().catch(() => 'Unknown error');
      return res.status(r.status).json({ error: `Graph API error: ${r.status}`, detail: errText.slice(0, 500) });
    }
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
}