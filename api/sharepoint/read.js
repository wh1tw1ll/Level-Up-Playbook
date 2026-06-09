// api/sharepoint/read.js — reads a specific file via driveId + itemId
async function refreshIfNeeded(tokenData) {
  if (tokenData.expires_at > Date.now() + 5*60*1000) return tokenData;
  if (!tokenData.refresh_token) return null;
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
    expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
    name: tokenData.name,
    email: tokenData.email
  };
}

function writeRefreshCookies(res, data) {
  const authPayload = JSON.stringify(data);
  const sessionPayload = JSON.stringify({ name: data.name, email: data.email, expires_at: data.expires_at });
  res.setHeader('Set-Cookie', [
    `lu_auth=${encodeURIComponent(authPayload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7*24*3600}`,
    `lu_session=${encodeURIComponent(sessionPayload)}; Path=/; Secure; SameSite=Lax; Max-Age=${7*24*3600}`
  ]);
}

export default async function handler(req, res) {
    // Parse cookie manually (consistent with other auth endpoints)
  const raw = req.headers['cookie'] || '';
    const cookies = {};
    raw.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) cookies[k.trim()]=v.join('=').trim(); });
    const enc = cookies['lu_auth'];
    if (!enc) return res.status(401).json({ error: 'Not authenticated' });

  let tokenData;
    try {
          tokenData = JSON.parse(decodeURIComponent(enc));
    } catch {
          return res.status(401).json({ error: 'Invalid auth' });
    }

  // Refresh token if needed
  const refreshed = await refreshIfNeeded(tokenData);
  if (!refreshed) return res.status(401).json({ error: 'Session expired' });
  if (refreshed !== tokenData) writeRefreshCookies(res, refreshed);

  const { driveId, itemId } = req.query;
    if (!driveId || !itemId) return res.status(400).json({ error: 'driveId and itemId required' });

  try {
        const fileRes = await fetch(
                `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
          {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                    redirect: 'follow',
          }
              );

      if (!fileRes.ok) {
              return res.status(fileRes.status).json({ error: 'File read failed' });
      }

      const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

      // For text-based files, return content directly
      if (contentType.includes('text') || contentType.includes('json')) {
              const text = await fileRes.text();
              return res.json({ content: text, contentType });
      }

      // For binary files (PDF, DOCX etc), return download URL instead
      const metaRes = await fetch(
              `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
            );
        const meta = await metaRes.json();
        res.json({
                downloadUrl: meta['@microsoft.graph.downloadUrl'],
                name: meta.name,
                contentType,
        });
  } catch (err) {
        console.error('File read error:', err);
        res.status(500).json({ error: 'Read failed' });
  }
}
