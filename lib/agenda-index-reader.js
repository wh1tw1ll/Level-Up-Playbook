// lib/agenda-index-reader.js — Read agendas from the AGENDA INDEX sheet (2008...)
// Parses AgendaJson into HTML renderable by the Prep tab.
// This is the ONLY source of agenda content — no fallback generators.
import smartsheet from './smartsheet.js';

const AGENDA_INDEX_SHEET_ID = '2008298489597828';

/**
 * Fetch agendas from Agenda Index and parse AgendaJson into HTML.
 * Returns array of { meetingSubject, meetingTime, agendaHtml, generatedAt }
 */
export async function getAgendaIndexAgendas() {
  try {
    const sheet = await smartsheet.getSheetWithColumns(AGENDA_INDEX_SHEET_ID);
    if (!sheet || !sheet.rows) return [];

    // Build column lookup
    const colMap = {};
    for (const col of sheet.columns || []) {
      colMap[col.title] = col.id;
    }
    if (!colMap.MeetingTitle || !colMap.AgendaJson) return [];

    const agendas = [];
    for (const row of sheet.rows || []) {
      const cells = {};
      for (const c of row.cells || []) {
        for (const [title, cid] of Object.entries(colMap)) {
          if (c.columnId === cid) {
            // Use raw value first, fall back to displayValue
            const v = c.value ?? c.displayValue ?? '';
            cells[title] = typeof v === 'string' ? v : String(v ?? '');
          }
        }
      }

      const meetingTitle = (cells.MeetingTitle || '').trim();
      if (!meetingTitle) continue;

      const agendaJsonRaw = cells.AgendaJson || '';
      let agendaHtml = '';
      if (agendaJsonRaw.startsWith('{')) {
        try {
          const parsed = JSON.parse(agendaJsonRaw);
          agendaHtml = renderAgendaJsonToHtml(parsed);
        } catch (e) {
          console.error('AgendaIndexReader: Failed to parse AgendaJson for', meetingTitle, e.message);
        }
      }

      if (!agendaHtml) continue; // Skip rows with no parseable agenda

      agendas.push({
        meetingSubject: meetingTitle,
        meetingTime: cells.StartDateTimeISO || cells.MeetingDate || '',
        agendaHtml,
        generatedAt: cells.GeneratedAt || '',
        eventId: (cells.EventId || '').trim(),
      });
    }

    return agendas;
  } catch (e) {
    console.error('agenda-index-reader error:', e.message);
    return [];
  }
}

/**
 * Given an EventId, return the matching agenda (or null).
 * Used by the Prep tab for exact-match lookup instead of word-overlap scoring.
 */
export async function getAgendaByEventId(eventId) {
  if (!eventId) return null;
  const agendas = await getAgendaIndexAgendas();
  return agendas.find(a => a.eventId === eventId) || null;
}

/**
 * Render the parsed AgendaJson object into HTML.
 * Handles two JSON schemas:
 *   Newer: { meta, attendees, agenda: [{time, num, title, subs}], footer }
 *   Older: { meta, sections: [{heading, items}], carryForward, leaveWith }
 */
function renderAgendaJsonToHtml(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';

  let html = '';

  // ── Title ──
  if (parsed.title) {
    html += '<h3>' + escapeHtml(parsed.title) + '</h3>';
  }

  // ── Meta ──
  if (Array.isArray(parsed.meta)) {
    html += '<div class="prep-agenda-meta">';
    for (const row of parsed.meta) {
      if (Array.isArray(row) && row.length >= 2) {
        html += '<div><strong>' + escapeHtml(String(row[0])) + ':</strong> ' + escapeHtml(String(row[1])) + '</div>';
      } else if (typeof row === 'string') {
        html += '<div>' + escapeHtml(row) + '</div>';
      }
    }
    html += '</div>';
  }

  // ── Attendees ──
  if (Array.isArray(parsed.attendees)) {
    html += '<div class="prep-agenda-attendees"><strong>Attendees:</strong> ';
    const parts = [];
    for (const g of parsed.attendees) {
      const firm = g.firm || g.role || '';
      const people = (g.people || []).join(', ');
      if (people) parts.push(people + (firm ? ' (' + escapeHtml(firm) + ')' : ''));
    }
    html += escapeHtml(parts.join('; '));
    html += '</div>';
  }

  // ── Agenda Items (newer schema: `agenda` array with items) ──
  if (Array.isArray(parsed.agenda)) {
    html += '<div class="prep-agenda-items">';
    for (const item of parsed.agenda) {
      const itemTitle = [];
      if (item.num) itemTitle.push(String(item.num) + '.');
      if (item.time) itemTitle.push('(' + escapeHtml(String(item.time)) + ')');
      if (item.title) itemTitle.push(escapeHtml(String(item.title)));
      html += '<div class="prep-agenda-item">';
      if (itemTitle.length > 0) html += '<strong>' + itemTitle.join(' ') + '</strong>';
      if (Array.isArray(item.subs)) {
        html += '<ul>';
        for (const sub of item.subs) {
          let subText = sub.text || sub.label || '';
          let subNote = sub.note || '';
          html += '<li>' + escapeHtml(String(subText));
          if (subNote) html += ' <span class="prep-agenda-note">(' + escapeHtml(String(subNote)) + ')</span>';
          html += '</li>';
        }
        html += '</ul>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // ── Sections (older schema) ──
  if (Array.isArray(parsed.sections)) {
    html += '<div class="prep-agenda-sections">';
    for (const section of parsed.sections) {
      const heading = section.heading || '';
      if (heading) html += '<h4>' + escapeHtml(String(heading)) + '</h4>';
      if (Array.isArray(section.items)) {
        html += '<ul>';
        for (const item of section.items) {
          let text = item.label || item.text || '';
          let assignee = item.assignee || item.owner || '';
          let due = item.due || '';
          let notes = item.notes || '';
          let parts = [text];
          if (assignee) parts.push('— ' + assignee);
          if (due) parts.push('Due: ' + due);
          if (notes) parts.push('(' + notes + ')');
          html += '<li>' + escapeHtml(parts.join(' ')) + '</li>';
        }
        html += '</ul>';
      }
    }
    html += '</div>';
  }

  // ── Carry Forward ──
  if (Array.isArray(parsed.carryForward)) {
    html += '<h4>Carry Forward</h4><ul>';
    for (const cf of parsed.carryForward) {
      const cfText = typeof cf === 'string' ? cf : (cf.label || cf.text || cf.title || '');
      if (cfText) html += '<li>' + escapeHtml(String(cfText)) + '</li>';
    }
    html += '</ul>';
  }

  // ── Leave With ──
  if (Array.isArray(parsed.leaveWith)) {
    html += '<h4>Leave With</h4><ul>';
    for (const lw of parsed.leaveWith) {
      const lwText = typeof lw === 'string' ? lw : (lw.label || lw.text || lw.title || '');
      if (lwText) html += '<li>' + escapeHtml(String(lwText)) + '</li>';
    }
    html += '</ul>';
  }

  // ── Footer ──
  if (parsed.footer) {
    html += '<div class="prep-agenda-footer">' + escapeHtml(String(parsed.footer)) + '</div>';
  }

  return html;
}

function escapeHtml(s) {
  if (typeof s !== 'string') return String(s || '');
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}