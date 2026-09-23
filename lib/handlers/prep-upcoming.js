// lib/handlers/prep-upcoming.js — GET /api/prep/upcoming
// Returns upcoming calendar events from Graph API + any generated agendas
import { setCors, handleOptions, parseCookies, getAccessToken } from '../auth.js';
import { getStoredAgendas } from './agendas-store.js';
import https from 'https';

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    // Get access token from the user's lu_auth cookie
    const cookies = parseCookies(req);
    const luAuth = cookies['lu_auth'];
    if (!luAuth) {
      return res.json({ 
        error: 'Not authenticated. Please sign in with Microsoft.',
        events: [], agendas: [], authRequired: true 
      });
    }

    let tokenData;
    try { tokenData = JSON.parse(decodeURIComponent(luAuth)); } catch {
      return res.status(401).json({ error: 'Invalid auth cookie', events: [], agendas: [] });
    }

    // Get a fresh access token for Graph API with Calendar scope
    const tokenResult = await getAccessToken(tokenData, 'Calendars.Read Calendars.Read.Shared');
    if (!tokenResult || !tokenResult.access_token) {
      return res.status(401).json({ error: 'Failed to refresh token. Please re-sign in.', events: [], agendas: [] });
    }
    const accessToken = tokenResult.access_token;

    // Fetch next 72 hours of calendar events
    const now = new Date();
    const end = new Date(now.getTime() + 72 * 3600000);
    const startParam = now.toISOString();
    const endParam = end.toISOString();

    const data = await httpsGet(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${encodeURIComponent(startParam)}&endDateTime=${encodeURIComponent(endParam)}&$select=subject,start,end,location,id,isAllDay,attendees,onlineMeeting&$orderby=start/dateTime&$top=50`,
      { Authorization: 'Bearer ' + accessToken }
    );

    const events = (data?.value || [])
      .filter(e => !e.isAllDay)
      .map(e => ({
        eventId: e.id,
        subject: e.subject || 'Untitled',
        start: e.start?.dateTime || '',
        end: e.end?.dateTime || '',
        location: e.location?.displayName || '',
        attendees: (e.attendees || []).map(a => ({
          name: a.emailAddress?.name || a.emailAddress?.address || '',
          email: a.emailAddress?.address || '',
        })),
        hasOnlineMeeting: !!e.onlineMeeting,
        isPast: new Date(e.start?.dateTime || 0) < now,
      }));

    // Get any already-generated agendas from persistent store
    const agendas = await getStoredAgendas();

    // Match agendas to events by subject — word-overlap scoring, not raw substring.
    // Handles "DOVA | i5 LED Coordination" vs "DOVA | i5 LED Design Coordination",
    // and "weekly touch point" vs "weekly touch base".
    function normalizeSubject(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'you', 'our', 'are', 'per', 're'].includes(w));
    }
    function subjectMatches(evSubject, agSubject) {
      if (!evSubject || !agSubject) return false;
      const a = normalizeSubject(evSubject);
      const b = normalizeSubject(agSubject);
      if (a.length === 0 || b.length === 0) return false;
      const short = a.length < b.length ? a : b;
      const long = a.length < b.length ? b : a;
      // All significant words of the shorter subject appear in the longer one
      const overlap = short.filter(w => long.includes(w)).length;
      return overlap / short.length >= 0.7;
    }

    const eventsWithAgendas = events.map(ev => {
      const match = agendas.find(a => subjectMatches(ev.subject, a.meetingSubject));
      return {
        ...ev,
        hasAgenda: !!match,
        agendaHtml: match?.agendaHtml || null,
        agendaGeneratedAt: match?.generatedAt || null,
      };
    });

    const upcoming = eventsWithAgendas.filter(e => !e.isPast);
    const past = eventsWithAgendas.filter(e => e.isPast).slice(0, 20);

    return res.json({ events: upcoming, past, allAgendas: agendas });

  } catch (err) {
    console.error('prep-upcoming error:', err.message);
    return res.status(500).json({ error: err.message, events: [], agendas: [] });
  }
}