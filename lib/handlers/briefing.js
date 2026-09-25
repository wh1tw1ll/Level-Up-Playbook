// lib/handlers/briefing.js — GET /api/briefing?date=YYYY-MM-DD
// Assembles today's operating picture: meetings, weather, urgent tasks,
// decisions needed, LUNA note, project pulse.
// Read-only, no sensitive data exposure — safe for auth bypass

import smartsheet from '../smartsheet.js';
import { parseCookies, getAccessToken } from '../auth.js';
import https from 'https';

const PROJECT_SHEET = '4456864287772548';
const PERSONAL_SHEET = '2802755367554948';

// ── HELPERS ──

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

// Parse a date query param or default to today
function resolveDate(queryDate) {
  if (queryDate) {
    const m = queryDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }
  return new Date();
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fmtDate(d);
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

function isOverdue(dateStr, now) {
  if (!dateStr) return false;
  const due = new Date(dateStr + 'T23:59:59');
  return due < now;
}

function isOnDate(taskDate, target) {
  if (!taskDate) return false;
  return taskDate.indexOf(fmtDate(target)) === 0;
}

function isInWeek(dateStr, now) {
  if (!dateStr) return false;
  const due = new Date(dateStr + 'T00:00:00');
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  return due > now && due <= endOfWeek;
}

function daysBetween(dateStr, now) {
  if (!dateStr) return 0;
  const due = new Date(dateStr + 'T23:59:59');
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

// WMO weather code → human label
const WMO_MAP = {
  0:  'Clear',
  1:  'Mostly clear',
  2:  'Partly cloudy',
  3:  'Overcast',
  45: 'Foggy',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm + hail',
  99: 'Thunderstorm + hail'
};

function fetchWeather(lat, lon) {
  return httpsGet(
    'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,precipitation_probability_max'
    + '&timezone=auto&forecast_days=1'
  ).then(function(d) {
    if (!d || !d.daily) return null;
    const day = d.daily;
    const code = (day.weathercode || [])[0];
    return {
      tempHigh: (day.temperature_2m_max || [])[0],
      tempLow: (day.temperature_2m_min || [])[0],
      precip: (day.precipitation_sum || [])[0] || 0,
      precipProb: (day.precipitation_probability_max || [])[0] || 0,
      condition: WMO_MAP[code] || 'Unknown',
      code: code
    };
  }).catch(function() { return null; });
}

function needsDecisionAlert(title) {
  if (!title) return false;
  const low = title.toLowerCase();
  const keywords = ['approve', 'approval', 'decision', 'decide', 'please review', 'sign', 'signature',
    'waiting on', 'needs review', 'action needed', 'bottleneck'];
  for (let i = 0; i < keywords.length; i++) {
    if (low.indexOf(keywords[i]) !== -1) return true;
  }
  return false;
}

// ── MAIN HANDLER ──

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  try {
    // Parse ?date= parameter for history browsing
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const dateParam = url.searchParams.get('date');
    const targetDate = resolveDate(dateParam);
    const now = new Date();
    const targetDateStr = fmtDate(targetDate);

    const isHistorical = fmtDate(targetDate) !== fmtDate(now);

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

    function addRow(row, cols, statusCol, source) {
      if (isComplete(row, cols, statusCol)) return;
      const dueDate = getCellValue(row, 'Due Date', cols);
      const title = getCellValue(row, 'Action', cols) || getCellValue(row, 'Task', cols) || 'Untitled';
      const project = getCellValue(row, 'Project', cols) || '';
      const owner = getCellValue(row, 'Owner', cols) || '';
      const firm = getCellValue(row, 'Firm', cols) || '';
      tasks.push({ title: title, dueDate: dueDate, project: project, owner: owner, firm: firm, source: source, rowId: row.id });
    }

    for (let i = 0; i < (projectSheet.rows || []).length; i++) {
      addRow(projectSheet.rows[i], projCols, projStatusCol, 'project');
    }
    for (let i = 0; i < (personalSheet.rows || []).length; i++) {
      addRow(personalSheet.rows[i], persCols, persStatusCol, 'personal');
    }

    // ── 4. BUILD ATTENTION ITEMS ──
    const attentionItems = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (isOverdue(t.dueDate, targetDate)) {
        attentionItems.push({
          level: 'critical',
          label: 'OVERDUE ' + daysBetween(t.dueDate, targetDate) + 'd',
          title: t.title, project: t.project, owner: t.owner,
          dueDate: t.dueDate, rowId: t.rowId, source: t.source
        });
      } else if (isOnDate(t.dueDate, targetDate)) {
        attentionItems.push({
          level: 'high',
          label: isHistorical ? formatDay(t.dueDate) : 'DUE TODAY',
          title: t.title, project: t.project, owner: t.owner,
          dueDate: t.dueDate, rowId: t.rowId, source: t.source
        });
      } else if (!isHistorical && isInWeek(t.dueDate, targetDate)) {
        attentionItems.push({
          level: 'upcoming',
          label: 'Due ' + formatDay(t.dueDate),
          title: t.title, project: t.project, owner: t.owner,
          dueDate: t.dueDate, rowId: t.rowId, source: t.source
        });
      }
    }

    attentionItems.sort(function(a, b) {
      var rank = { critical: 0, high: 1, upcoming: 2 };
      var r = (rank[a.level] !== undefined ? rank[a.level] : 9) - (rank[b.level] !== undefined ? rank[b.level] : 9);
      if (r !== 0) return r;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });

    // ── 5. WEATHER (today only, real-time) ──
    let weather = null;
    if (!isHistorical) {
      const mfpWx = fetchWeather('25.76', '-80.19').catch(function() { return null; });   // MFP: Miami
      const dovaWx = fetchWeather('33.75', '-84.39').catch(function() { return null; });  // DOVA: Atlanta

      const results = await Promise.all([mfpWx, dovaWx]);
      weather = {
        mfp: results[0],
        dova: results[1],
        alert: null
      };

      // Generate alert
      const mfpAlert = results[0] && (results[0].code >= 61 || results[0].precipProb > 40)
        ? 'MFP: ' + results[0].condition + ', ' + results[0].precipProb + '% rain, ' + Math.round(results[0].tempHigh) + '°/' + Math.round(results[0].tempLow) + '°'
        : null;
      const dovaAlert = results[1] && (results[1].code >= 61 || results[1].precipProb > 40)
        ? 'DOVA: ' + results[1].condition + ', ' + results[1].precipProb + '% rain, ' + Math.round(results[1].tempHigh) + '°/' + Math.round(results[1].tempLow) + '°'
        : null;

      if (mfpAlert && dovaAlert) {
        weather.alert = '🌧 Both sites wet today. ' + mfpAlert + ' · ' + dovaAlert;
      } else if (mfpAlert) {
        weather.alert = '🌧 ' + mfpAlert + ' — pack gear if heading to site.';
      } else if (dovaAlert) {
        weather.alert = '🌧 ' + dovaAlert + ' — pack gear if heading to site.';
      } else if (results[0] && results[1]) {
        const mfpNice = results[0].condition + ', ' + Math.round(results[0].tempHigh) + '°';
        const dovaNice = results[1].condition + ', ' + Math.round(results[1].tempHigh) + '°';
        weather.alert = '☀️ MFP: ' + mfpNice + ' · DOVA: ' + dovaNice + ' — good site conditions.';
      } else if (results[0]) {
        weather.alert = '☀️ MFP: ' + results[0].condition + ', ' + Math.round(results[0].tempHigh) + '°';
      }
    }

    // ── 6. DECISION NEEDED ──
    const decisions = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const isWhitneyOwner = t.owner && t.owner.toLowerCase() === 'whitney';
      const isOverdueItem = isOverdue(t.dueDate, targetDate);
      const isDueToday = isOnDate(t.dueDate, targetDate);
      const needsIt = needsDecisionAlert(t.title);

      if ((isOverdueItem && isWhitneyOwner) || (isOverdueItem && needsIt) || (isDueToday && needsIt)) {
        decisions.push({
          title: t.title,
          project: t.project,
          owner: t.owner,
          dueDate: t.dueDate,
          label: isOverdueItem ? 'Overdue ' + daysBetween(t.dueDate, targetDate) + 'd' : 'Due today',
          rowId: t.rowId,
          source: t.source
        });
      }
    }

    decisions.sort(function(a, b) {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });

    // ── 7. TRY TO FETCH CALENDAR EVENTS ──
    const cookies = parseCookies(req);
    const luAuth = cookies['lu_auth'];
    let events = [];

    if (luAuth && !isHistorical) {
      try {
        const tokenData = JSON.parse(decodeURIComponent(luAuth));
        const tokenResult = await getAccessToken(tokenData, 'Calendars.Read Calendars.Read.Shared');
        if (tokenResult && tokenResult.access_token) {
          const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
          const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

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
        console.error('Briefing calendar error:', e.message);
      }
    }

    // ── 8. BUILD PROJECT PULSE ──
    const projectMap = {};

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const proj = t.project || 'General';
      if (!projectMap[proj]) {
        projectMap[proj] = { total: 0, overdue: 0, dueToday: 0, dueThisWeek: 0 };
      }
      projectMap[proj].total++;
      if (isOverdue(t.dueDate, targetDate)) projectMap[proj].overdue++;
      if (isOnDate(t.dueDate, targetDate)) projectMap[proj].dueToday++;
      if (!isHistorical && isInWeek(t.dueDate, targetDate)) projectMap[proj].dueThisWeek++;
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

    // ── 9. LUNA NOTE ──
    let lunaNote = null;
    const criticalCount = attentionItems.filter(function(i) { return i.level === 'critical'; }).length;
    const highCount = attentionItems.filter(function(i) { return i.level === 'high'; }).length;

    if (isHistorical) {
      lunaNote = { icon: '📜', text: 'Viewing briefing for ' + formatDay(targetDateStr) + '. Tap "Today" to return to current.' };
    } else if (decisions.length > 0 && criticalCount === 0) {
      lunaNote = { icon: '✋', text: decisions.length + ' item' + (decisions.length > 1 ? 's' : '') + ' need' + (decisions.length === 1 ? 's' : '') + ' your decision. Check the Decision Queue section.' };
    } else if (criticalCount > 0) {
      const worst = attentionItems.find(function(i) { return i.level === 'critical'; });
      lunaNote = {
        icon: '⚡',
        text: 'You have ' + criticalCount + ' overdue item' + (criticalCount > 1 ? 's' : '') + '. "' + worst.title + '" is the oldest — ' + daysBetween(worst.dueDate, targetDate) + ' days past due.'
      };
    } else if (highCount > 2) {
      lunaNote = { icon: '🎯', text: highCount + ' items due today. Start with the ' + (events.length > 0 ? 'morning' : 'earliest') + ' — momentum carries.' };
    } else if (events.length === 0 && attentionItems.length === 0) {
      lunaNote = { icon: '✓', text: 'Nothing urgent today. Good day for deep work or catching up on the backlog.' };
    } else {
      const upcomingCount = attentionItems.length - criticalCount - highCount;
      lunaNote = {
        icon: '💡',
        text: (events.length > 0 ? events.length + ' meeting' + (events.length > 1 ? 's' : '') + ' on the calendar' : 'No meetings scheduled') + '. '
          + (upcomingCount > 0 ? upcomingCount + ' item' + (upcomingCount > 1 ? 's' : '') + ' coming up this week.' : 'Take a breath — week looks manageable.')
      };
    }

    // ── 10. AUDIO SUMMARY (plain text suitable for TTS) ──
    let audioSummary = '';

    if (!isHistorical) {
      audioSummary = getGreeting() + ', Whitney. ';
      audioSummary += 'It is ' + formatDay(targetDateStr) + '. ';
      audioSummary += 'You have ' + tasks.length + ' open tasks. ';

      if (events.length > 0) {
        audioSummary += 'You have ' + events.length + ' meeting' + (events.length > 1 ? 's' : '') + ' today. ';
        for (let i = 0; i < Math.min(events.length, 3); i++) {
          const e = events[i];
          const t = new Date(e.start);
          let hour = t.getHours();
          const min = String(t.getMinutes()).padStart(2, '0');
          const ampm = hour >= 12 ? 'PM' : 'AM';
          hour = hour % 12 || 12;
          audioSummary += hour + ' ' + min + ' ' + ampm + ', ' + e.subject + '. ';
        }
      }

      if (criticalCount > 0) {
        audioSummary += 'Warning: ' + criticalCount + ' item' + (criticalCount > 1 ? 's are' : ' is') + ' overdue. ';
      }
      if (decisions.length > 0) {
        audioSummary += decisions.length + ' item' + (decisions.length > 1 ? 's' : '') + ' need your decision. ';
      }
      if (weather && weather.alert) {
        audioSummary += weather.alert.replace(/[🌧☀️]/g, '').trim() + '. ';
      }
    }

    // ── 11. RESPOND ──
    res.json({
      date: targetDateStr,
      todayDate: fmtDate(now),
      dayLabel: formatDay(targetDateStr),
      isHistorical: isHistorical,
      yesterday: yesterdayStr(),
      greeting: getGreeting(),
      name: 'Whitney',
      weather: weather,
      events: events,
      attentionItems: attentionItems.slice(0, 20),
      decisions: decisions.slice(0, 10),
      projectPulse: projectPulse,
      lunaNote: lunaNote,
      audioSummary: audioSummary,
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