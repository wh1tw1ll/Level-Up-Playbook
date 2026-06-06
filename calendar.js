// calendar.js - Outlook calendar integration for Level Up Playbook
async function renderCalendar() {
    const c = document.getElementById('calendar-events-container');
    if (!c) return;

  if (!window.luUser || !window.luUser.authenticated) {
        try { await checkAuth(); } catch(e) {}
  }

  if (!window.luUser || !window.luUser.authenticated) {
        c.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--muted)"><div style="font-size:48px;margin-bottom:16px">&#128197;</div><div style="font-size:15px;font-weight:600;color:var(--charcoal);margin-bottom:8px">Connect Your Outlook Calendar</div><div style="font-size:13px;margin-bottom:20px">Sign in with Microsoft to view upcoming events</div><button onclick="signInWithMicrosoft()" style="padding:10px 28px;background:var(--teal);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Sign in with Microsoft</button></div>';
        return;
  }

  c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Loading your calendar...</div>';

  try {
        const r = await fetch('/api/outlook/calendar?days=14');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        const evts = data.value || [];

      if (!evts.length) {
              c.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted)"><div style="font-size:32px;margin-bottom:12px">&#128197;</div>No upcoming events in the next 14 days.</div>';
              return;
      }

      // Group by date
      const byDate = {};
        evts.forEach(function(e) {
                const dt = (e.start.dateTime || e.start.date || '').slice(0, 10);
                if (!byDate[dt]) byDate[dt] = [];
                byDate[dt].push(e);
        });

      let html = '<div style="max-width:720px">';
        Object.keys(byDate).sort().forEach(function(dt) {
                const d = new Date(dt + 'T12:00:00');
                const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                html += '<div style="margin-bottom:28px">';
                html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;padding-bottom:8px;border-bottom:2px solid var(--teal);margin-bottom:12px">' + label + '</div>';
                byDate[dt].forEach(function(e) {
                          const start = e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day';
                          const end = e.end && e.end.dateTime ? new Date(e.end.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
                          const timeStr = end ? start + ' - ' + end : start;
                          html += '<div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start">';
                          html += '<div style="min-width:110px;font-size:11px;font-weight:600;color:var(--teal);padding-top:2px;flex-shrink:0">' + timeStr + '</div>';
                          html += '<div style="flex:1">';
                          html += '<div style="font-size:13px;font-weight:600;color:var(--charcoal);margin-bottom:2px">' + (e.subject || '(No title)') + '</div>';
                          if (e.location && e.location.displayName) {
                                      html += '<div style="font-size:11px;color:var(--muted)">&#128205; ' + e.location.displayName + '</div>';
                          }
                          if (e.organizer && e.organizer.emailAddress && e.organizer.emailAddress.name) {
                                      html += '<div style="font-size:11px;color:var(--muted)">&#128100; ' + e.organizer.emailAddress.name + '</div>';
                          }
                          html += '</div>';
                          if (e.webLink) {
                                      html += '<a href="' + e.webLink + '" target="_blank" style="font-size:11px;color:var(--teal);text-decoration:none;flex-shrink:0;padding-top:2px">Open &#8599;</a>';
                          }
                          html += '</div>';
                });
                html += '</div>';
        });
        html += '</div>';
        c.innerHTML = html;
  } catch (err) {
        c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Could not load calendar. <button onclick="renderCalendar()" style="color:var(--teal);background:none;border:none;cursor:pointer;font-family:inherit;font-size:13px;text-decoration:underline">Retry</button></div>';
  }
}
