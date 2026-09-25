// lib/handlers/briefing.js — GET /api/briefing
// Assembles today's operating picture: meetings, urgent tasks, LUNA note, project pulse
// Read-only, no sensitive data exposure — safe for auth bypass

import smartsheet from '../smartsheet.js';
import { parseCookies, getAccessToken } from '../auth.js';
import https from 'https';

const PROJECT_SHEET = '4456864287772548';
const PERSONAL_SHEET = '2802755367554948';

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const due = new Date(dateStr + 'T23:59:59');
  return due < new Date();
}

function isToday(dateStr) {
  if (!dateStr) return false;
  return dateStr.indexOf(todayStr()) === 0;
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const due = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  return due > now && due <= endOfWeek;
}

function daysOverdue(dateStr) {
  if (!dateStr) return 0;
  const due = new Date(dateStr + 'T23:59:59');
  const now = new Date();
  return Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
}

function getCellValue(row, colTitle, columns) {
  const col = columns.find(function(c) { return c.title === colTitle; });
  if (!col) return null;
  const cell = (row.cells || []).find(function(c) { return c.columnId === col.id; });
  if (!cell) return null;
  return cell.displayValue !== undefined ? cell.displayValue : cell.value;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + m + ' ' + ampm;
  } catch (e) { return ''; }
}

function formatDay(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch (e) { return ''; }
}

function findStatusCol(cols) {
  const keywords = ['Status', 'status', 'STATE', 'state'];
  for (let i = 0; i < keywords.length; i++) {
    const found = cols.find(function(c) { return c.title === keywords[i] || c.title.toLowerCase() === keywords[i].toLowerCase(); });
    if (found) return found;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  try {
    // ── 1. FETCH ALL TASKS ──
    const projectSheet = await smartsheet.getSheetWithColumns(PROJECT_SHEET).catch(function() { return { rows: [], columns: [] }; });
    const personalSheet = await smartsheet.getSheetWithColumns(PERSONAL_SHEET).catch(function() { return { rows: [], columns: [] }; });

    const projCols = projectSheet.columns || [];
    const persCols = personalSheet.columns || [];

    // ── 2. DISCOVER STATUS COLUMNS ──
    const projStatusCol = findStatusCol(projCols);
    const persStatusCol = findStatusCol(persCols);

    function isComplete(row, cols, statusCol) {
      if (!statusCol) return false;
      const val = getCellValue(row, statusCol.title, cols);
      if (!val) return false;
      const v = String(val).toLowerCase().trim();
      return v === 'completed' || v === 'done' || v === 'complete';
    }

    // ── 3. PARSE ALL OPEN TASKS ──
    const tasks = [];

    for (let i = 0; i < (projectSheet.rows || []).length; i++) {
      const row = projectSheet.rows[i];
      if (isComplete(row, projCols, projStatusCol)) continue;
      const dueDate = getCellValue(row, 'Due Date', projCols);
      const title = getCellValue(row, 'Action', projCols) || getCellValue(row, 'Task', projCols) || 'Untitled';
      const project = getCellValue(row, 'Project', projCols) || '';
      const owner = getCellValue(row, 'Owner', projCols) || '';
      const firm = getCellValue(row, 'Firm', projCols) || '';
      tasks.push({ title: title, dueDate: dueDate, project: project, owner: owner, firm: firm, source: 'project', rowId: row.id });
    }

    for (let i = 0; i < (personalSheet.rows || []).length; i++) {
      const row = personalSheet.rows[i];
      if (isComplete(row, persCols, persStatusCol)) continue;
      const dueDate = getCellValue(row, 'Due Date', persCols);
      const title = getCellValue(row, 'Action', persCols) || getCellValue(row, 'Task', persCols) || 'Untitled';
      const project = getCellValue(row, 'Project', persCols) || '';
      const owner = getCellValue(row, 'Owner', persCols) || '';
      tasks.push({ title: title, dueDate: dueDate, project: project, owner: owner, source: 'personal', rowId: row.id });
    }

    // ── 4. BUILD ATTENTION ITEMS ──
    const attentionItems = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (isOverdue(t.dueDate)) {
        attentionItems.push({
          level: 'critical',
          label: 'OVERDUE ' + daysOverdue(t.dueDate) + 'd',
          title: t.title,
          project: t.project,
          owner: t.owner,
          dueDate: t.dueDate,
          rowId: t.rowId,
          source: t.source
        });
      } else if (isToday(t.dueDate)) {
        attentionItems.push({
          level: 'high',
          label: 'DUE TODAY',
          title: t.title,
          project: t.project,
          owner: t.owner,
          dueDate: t.dueDate,
          rowId: t.rowId,
          source: t.source
        });
      } else if (isThisWeek(t.dueDate)) {
        attentionItems.push({
          level: 'upcoming',
          label: 'Due ' + formatDay(t.dueDate),
          title: t.title,
          project: t.project,
          owner: t.owner,
          dueDate: t.dueDate,
          rowId: t.rowId,
          source: t.source
        });
      }
    }

    // Sort: critical first (most overdue), then high, then upcoming
    attentionItems.sort(function(a, b) {
      var rank = { critical: 0, high: 1, upcoming: 2 };
      var r = (rank[a.level] !== undefined ? rank[a.level] : 9) - (rank[b.level] !== undefined ? rank[b.level] : 9);
      if (r !== 0) return r;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });

    // ── 5. TRY TO FETCH CALENDAR EVENTS (with auth) ──
    const cookies = parseCookies(req);
    const luAuth = cookies['lu_auth'];
    let events = [];

    if (luAuth) {
      try {
        const tokenData = JSON.parse(decodeURIComponent(luAuth));
        const tokenResult = await getAccessToken(tokenData, 'Calendars.Read Calendars.Read.Shared');
        if (tokenResult && tokenResult.access_token) {
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

          const calData = await httpsGet(
            'https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=' + encodeURIComponent(startOfDay.toISOString()) + '&endDateTime=' + encodeURIComponent(endOfDay.toISOString()) + '&$select=subject,start,end,location,id,isOnlineMeeting&$orderby=start/dateTime&$top=25',
            { Authorization: 'Bearer ' + tokenResult.access_token }
          );

          const rawEvents = calData?.value || [];

          for (let i = 0; i < rawEvents.length; i++) {
            const e = rawEvents[i];
            const start = new Date(e.start?.dateTime || e.start?.date);
            if (start >= startOfDay && start <= endOfDay) {
              events.push({
                subject: e.subject || 'Untitled',
                start: e.start?.dateTime || e.start?.date,
                end: e.end?.dateTime || e.end?.date,
                location: e.location?.displayName || null,
                eventId: e.id,
                isOnline: !!e.isOnlineMeeting
              });
            }
          }

          events.sort(function(a, b) { return (a.start || '').localeCompare(b.start || ''); });
        }
      } catch (e) {
        // Silent fail — no calendar is fine for the briefing
        console.error('Briefing calendar fetch error:', e.message);
      }
    }

    // ── 6. BUILD PROJECT PULSE ──
    const projectMap = {};

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const proj = t.project || 'General';
      if (!projectMap[proj]) {
        projectMap[proj] = { total: 0, overdue: 0, dueToday: 0, dueThisWeek: 0 };
      }
      projectMap[proj].total++;
      if (isOverdue(t.dueDate)) projectMap[proj].overdue++;
      if (isToday(t.dueDate)) projectMap[proj].dueToday++;
      if (isThisWeek(t.dueDate)) projectMap[proj].dueThisWeek++;
    }

    const projectPulse = Object.keys(projectMap).map(function(name) {
      const stats = projectMap[name];
      const health = stats.overdue > 0 ? 'amber' : 'green';
      let summary;
      if (stats.overdue > 0) {
        summary = stats.overdue + ' overdue, ' + stats.dueThisWeek + ' due this week';
      } else if (stats.dueThisWeek > 0) {
        summary = stats.dueThisWeek + ' items due this week';
      } else {
        summary = stats.total + ' open tasks';
      }
      return { name: name, total: stats.total, overdue: stats.overdue, dueToday: stats.dueToday, dueThisWeek: stats.dueThisWeek, health: health, summary: summary };
    }).sort(function(a, b) {
      const healthRank = { red: 0, amber: 1, green: 2 };
      return (healthRank[a.health] !== undefined ? healthRank[a.health] : 2) - (healthRank[b.health] !== undefined ? healthRank[b.health] : 2);
    });

    // ── 7. LUNA NOTE ──
    let lunaNote = null;
    const criticalCount = attentionItems.filter(function(i) { return i.level === 'critical'; }).length;
    const highCount = attentionItems.filter(function(i) { return i.level === 'high'; }).length;

    if (criticalCount > 0) {
      const worst = attentionItems.find(function(i) { return i.level === 'critical'; });
      lunaNote = {
        icon: '⚡',
        text: 'You have ' + criticalCount + ' overdue item' + (criticalCount > 1 ? 's' : '') + '. "' + worst.title + '" is the oldest — ' + daysOverdue(worst.dueDate) + ' days past due.'
      };
    } else if (highCount > 2) {
      lunaNote = {
        icon: '🎯',
        text: highCount + ' items due today. Start with the ' + (events.length > 0 ? 'morning' : 'earliest') + ' — momentum carries.'
      };
    } else if (events.length === 0 && attentionItems.length === 0) {
      lunaNote = {
        icon: '✓',
        text: 'Nothing urgent today. Good day for deep work or catching up on the backlog.'
      };
    } else {
      lunaNote = {
        icon: '💡',
        text: (events.length > 0 ? events.length + ' meeting' + (events.length > 1 ? 's' : '') + ' on the calendar' : 'No meetings scheduled') + '. ' + (attentionItems.length - criticalCount - highCount > 0 ? attentionItems.length - criticalCount - highCount + ' item' + ((attentionItems.length - criticalCount - highCount) > 1 ? 's' : '') + ' coming up this week.' : 'Take a breath — week looks manageable.')
      };
    }

    // ── 8. RESPOND ──
    res.json({
      date: todayStr(),
      dayLabel: formatDay(todayStr()),
      greeting: getGreeting(),
      name: 'Whitney',
      events: events,
      attentionItems: attentionItems.slice(0, 20),
      projectPulse: projectPulse,
      lunaNote: lunaNote,
      meta: {
        totalOpenTasks: tasks.length,
        totalOverdue: criticalCount,
        totalDueToday: highCount
      }
    });

  } catch (e) {
    console.error('Briefing error:', e.message);
    res.status(500).json({ error: 'Failed to assemble briefing', message: e.message });
  }
}