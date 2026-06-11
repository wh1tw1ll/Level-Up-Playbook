// lib/handlers/calendar.js — Fetch calendar events (primary + shared calendars)
import { setCors, handleOptions, authenticateRequest } from '../auth.js';

const EXTRA_SCOPE = 'Calendars.Read Calendars.Read.Shared';

export default async function handler(req, res) {
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const fresh = await authenticateRequest(req, res, EXTRA_SCOPE);
  if (!fresh) return;

  const days = parseInt(req.query.days || '14');
  const now = new Date().toISOString();
  const end = new Date(Date.now() + days * 86400000).toISOString();

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

        // Include shared calendars (skip own primary)
        const sharedCals = calendars.filter(c => {
          const ownerEmail = c.owner?.name?.emailAddress?.address;
          if (ownerEmail && ownerEmail === fresh.email) return false;
          return true;
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
              allEvents.forEach(e => {
                existingKeys[e.subject + '|' + (e.start?.dateTime || '')] = true;
              });
              calEvents.forEach(e => {
                const key = e.subject + '|' + (e.start?.dateTime || '');
                if (!existingKeys[key]) {
                  existingKeys[key] = true;
                  allEvents.push(e);
                }
              });
            }
          } catch (calErr) {
            console.error('Shared calendar fetch error:', cal.id, calErr.message);
          }
        }
      }
    } catch (calListErr) {
      console.error('Calendar list error:', calListErr.message);
    }

    // 3. Sort all events by start time
    allEvents.sort((a, b) =>
      new Date(a.start?.dateTime || a.start?.date || 0) - new Date(b.start?.dateTime || b.start?.date || 0)
    );

    res.json({ value: allEvents });
  } catch (e) {
    console.error('Calendar API exception:', e.message);
    res.status(500).json({ error: e.message });
  }
}