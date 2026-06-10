// api/outlook/calendar.js — fetches calendar events using refresh-only cookie
// Also checks shared calendars (MFP, project calendars) for cross-tenant meetings
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
      scope: 'openid profile email offline_access Files.Read.All Sites.Read.All Mail.Read Calendars.Read Calendars.Read.Shared User.Read'
    })
  });
  const tokens = await r.json();
  if (tokens.error || !tokens.access_token) {
    console.error('Token refresh failed:', tokens.error);
    return null;
  }
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

function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    `lu_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `lu_session=; Path=/; Secure; SameSite=Lax; Max-Age=0`
  ]);
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
  if (!fresh) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Session expired' });
  }

  writeRefreshCookies(res, fresh);

  const days = parseInt(req.query.days||'14');
  const now  = new Date().toISOString();
  const end  = new Date(Date.now() + days*86400000).toISOString();

  try {
    // 1. Fetch primary calendar events
    const primaryUrl = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${encodeURIComponent(now)}&endDateTime=${encodeURIComponent(end)}&$select=subject,start,end,location,isAllDay&$top=50`;
    const primaryRes = await fetch(primaryUrl, {
      headers: { Authorization: `Bearer ${fresh.access_token}` }
    });

    let allEvents = [];
    if (primaryRes.ok) {
      const primaryData = await primaryRes.json();
      allEvents = primaryData.value || [];
    } else {
      const errText = await primaryRes.text().catch(() => '');
      console.error('Primary calendar error', primaryRes.status, errText.slice(0, 200));
    }

    // 2. Check for shared/accessible calendars (MFP, project calendars, etc.)
    try {
      const calListUrl = 'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,owner&$top=50';
      const calListRes = await fetch(calListUrl, {
        headers: { Authorization: `Bearer ${fresh.access_token}` }
      });

      if (calListRes.ok) {
        const calListData = await calListRes.json();
        const calendars = calListData.value || [];

        // Filter to non-primary calendars that look MFP-related or could have project meetings
        const mfpKeywords = ['miami', 'freedom', 'park', 'mfp', 'stadium', 'project', 'closeout', 'construction', 'owner', 'site'];
        const sharedCals = calendars.filter(c => {
          if (c.id === fresh.email ? c.id : false) return false; // skip primary
          const name = (c.name || '').toLowerCase();
          return mfpKeywords.some(kw => name.includes(kw));
        });

        // Fetch events from each shared calendar
        for (const cal of sharedCals) {
          try {
            const calUrl = `https://graph.microsoft.com/v1.0/me/calendars/${cal.id}/calendarview?startDateTime=${encodeURIComponent(now)}&endDateTime=${encodeURIComponent(end)}&$select=subject,start,end,location,isAllDay&$top=50`;
            const calRes = await fetch(calUrl, {
              headers: { Authorization: `Bearer ${fresh.access_token}` }
            });
            if (calRes.ok) {
              const calData = await calRes.json();
              const calEvents = (calData.value || []).map(e => ({
                ...e,
                _calendarName: cal.name
              }));
              // Merge, dedup by subject + start time
              const existingKeys = {};
              allEvents.forEach(e => { existingKeys[e.subject + '|' + (e.start?.dateTime||'')] = true; });
              calEvents.forEach(e => {
                const key = e.subject + '|' + (e.start?.dateTime||'');
                if (!existingKeys[key]) {
                  existingKeys[key] = true;
                  allEvents.push(e);
                }
              });
            }
          } catch(calErr) {
            console.error('Shared calendar fetch error:', cal.id, calErr.message);
          }
        }
      }
    } catch(calListErr) {
      console.error('Calendar list error:', calListErr.message);
    }

    // 3. Sort all events by start time
    allEvents.sort((a, b) => {
      return new Date(a.start?.dateTime || a.start?.date || 0) - new Date(b.start?.dateTime || b.start?.date || 0);
    });

    res.json({ value: allEvents });
  } catch(e) {
    console.error('Calendar API exception:', e.message);
    res.status(500).json({ error: e.message });
  }
}