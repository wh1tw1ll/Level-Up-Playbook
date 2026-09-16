const fs = require('fs');
const https = require('https');

// Step 1: Read token file
const tokenPath = 'C:\\Users\\HermesAdmin\\.hermes\\msal_tokens.json';
const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

// Step 2: Refresh the token
const refreshBody = new URLSearchParams({
  client_id: 'd43fa6d5-ac58-4c6a-a0a1-083a1573ab03',
  refresh_token: tokens.refresh_token,
  grant_type: 'refresh_token',
  scope: 'openid profile email offline_access Calendars.Read User.Read Mail.Read Files.Read.All Sites.Read.All'
});

function doGraphRequest(path, token) {
  return new Promise((resolve, reject) => {
    const url = 'https://graph.microsoft.com/v1.0' + path;
    https.get(url, { headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

async function getPastInstances(seriesMasterId, token) {
  try {
    const start = '2026-09-01T00:00:00Z';
    const end = '2026-09-16T23:59:00Z';
    const path = '/me/calendar/events/' + encodeURIComponent(seriesMasterId) + '/instances?startDateTime=' + encodeURIComponent(start) + '&endDateTime=' + encodeURIComponent(end) + '&$select=subject,start,end,id';
    const d = await doGraphRequest(path, token);
    return d.value || [];
  } catch(e) {
    return [];
  }
}

const req = https.request('https://login.microsoftonline.com/8222d14d-0869-42d3-8b7f-858c65b89c0e/oauth2/v2.0/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}, async (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', async () => {
    const r = JSON.parse(data);
    if (r.error) {
      console.log(JSON.stringify({ error: 'Token refresh failed', detail: r.error_description }));
      return;
    }
    const tok = r.access_token;
    
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 14*86400000).toISOString();
    const encodedNow = encodeURIComponent(now);
    const encodedEnd = encodeURIComponent(end);
    
    const eventsUrl = '/me/calendarview?startDateTime=' + encodedNow + '&endDateTime=' + encodedEnd + '&$select=subject,start,end,id,seriesMasterId,type,recurrence,location&$top=50';
    const eventsData = await doGraphRequest(eventsUrl, tok);
    
    if (eventsData.error) {
      console.log(JSON.stringify({ error: 'Graph query failed', detail: eventsData.error }));
      return;
    }
    
    const events = eventsData.value || [];
    const report = { events: [] };
    
    for (const e of events) {
      const entry = {
        subject: e.subject,
        start: e.start?.dateTime || e.start?.date || null,
        type: e.type || 'occurrence',
        seriesMasterId: e.seriesMasterId || null,
        location: e.location?.displayName || '',
        isRecurring: !!(e.seriesMasterId || e.type === 'seriesMaster')
      };
      
      if (entry.seriesMasterId) {
        const past = await getPastInstances(entry.seriesMasterId, tok);
        entry.pastInstanceCount = past.length;
        if (past.length > 0) {
          const sorted = past.sort((a, b) => new Date(b.start?.dateTime) - new Date(a.start?.dateTime));
          entry.latestPastInstance = {
            subject: sorted[0].subject,
            start: sorted[0].start?.dateTime || sorted[0].start?.date,
            eventId: sorted[0].id
          };
        }
      } else {
        entry.pastInstanceCount = 0;
      }
      
      report.events.push(entry);
    }
    
    console.log(JSON.stringify(report, null, 2));
  });
});
req.write(refreshBody.toString());
req.end();