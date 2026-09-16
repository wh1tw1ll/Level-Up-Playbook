const https = require('https');
const fs = require('fs');
const tokens = JSON.parse(fs.readFileSync('C:\\Users\\HermesAdmin\\.hermes\\msal_tokens.json', 'utf8'));

function doGraph(path, token) {
  return new Promise((resolve, reject) => {
    https.get('https://graph.microsoft.com/v1.0' + path, { headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  const refreshBody = new URLSearchParams({
    client_id: 'd43fa6d5-ac58-4c6a-a0a1-083a1573ab03',
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
    scope: 'openid profile email offline_access Calendars.Read User.Read'
  });

  const r = await new Promise((resolve, reject) => {
    const req = https.request('https://login.microsoftonline.com/8222d14d-0869-42d3-8b7f-858c65b89c0e/oauth2/v2.0/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.write(refreshBody.toString());
    req.end();
  });
  if (r.error) { console.log(JSON.stringify({error: 'TOKEN', detail: r.error})); return; }
  const tok = r.access_token;

  // Get upcoming events
  const now = new Date().toISOString();
  const end = new Date(Date.now() + 14*86400000).toISOString();
  const upcoming = await doGraph('/me/calendarview?startDateTime=' + encodeURIComponent(now) + '&endDateTime=' + encodeURIComponent(end) + '&$select=subject,start,end,id,seriesMasterId,type,recurrence,location&$top=50', tok);
  if (upcoming.error) { console.log(JSON.stringify({error: 'GRAPH', detail: upcoming.error})); return; }
  const events = upcoming.value || [];

  // Get series master IDs
  const seriesMasters = [...new Set(events.map(e => e.seriesMasterId).filter(Boolean))];
  const seriesData = {};
  for (const sm of seriesMasters) {
    const inst = await doGraph('/me/calendar/events/' + encodeURIComponent(sm) + '/instances?startDateTime=2026-09-01T00:00:00Z&endDateTime=2026-09-15T23:59:00Z&$select=subject,start,end,id&$top=10', tok);
    seriesData[sm] = (inst.value || []).sort((a, b) => new Date(b.start?.dateTime) - new Date(a.start?.dateTime));
  }

  console.log(JSON.stringify({ events, seriesData }, null, 2));
}

main().catch(e => console.log(JSON.stringify({error: 'MAIN', detail: e.message})));