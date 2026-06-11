// lib/handlers/flagged.js — Merge To Do flagged emails + Graph API filter + stored MFP flagged emails
// Primary source: Microsoft To Do flaggedEmails well-known list (reliable cross-folder)
// Fallback: Graph API flag/flagStatus filter (supplemental)
// Merge with locally-synced MFP flagged emails

import { setCors, handleOptions, authenticateRequest } from '../auth.js';

// In-memory storage for locally-synced MFP flagged emails
let storedData = null;
export function setStoredData(d) { storedData = d; }

const FLAGGED_SCOPE = 'Mail.Read Tasks.Read';

/**
 * Fetch flagged emails from Microsoft To Do flaggedEmails list.
 * This is cross-folder and maintained by Exchange — reliable.
 */
async function fetchFromTodoList(token) {
  try {
    // 1. Find the flaggedEmails well-known list
    const listRes = await fetch(
      'https://graph.microsoft.com/v1.0/me/todo/lists',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) return [];

    const listData = await listRes.json();
    const lists = listData.value || [];
    const flaggedList = lists.find(l => l.wellknownListName === 'flaggedEmails');
    if (!flaggedList) return [];

    // 2. Fetch tasks from the flaggedEmails list
    const tasksRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${flaggedList.id}/tasks?$expand=linkedResources&$top=50&$orderby=createdDateTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!tasksRes.ok) return [];

    const tasksData = await tasksRes.json();
    return (tasksData.value || []).map(t => ({
      subject: t.title || '(No subject)',
      from: 'Outlook (Flagged)',
      received: t.createdDateTime,
      preview: (t.body?.content || '').slice(0, 200).replace(/<[^>]*>/g, ''),
      url: t.linkedResources?.[0]?.webUrl || '',
      source: 'Outlook (To Do)',
      flagged_at: t.createdDateTime
    }));
  } catch (e) {
    console.error('To Do API error:', e.message);
    return [];
  }
}

/**
 * Fallback: fetch flagged/high-importance emails via Graph filter.
 * Known limitation: combined with $orderby this can return 400 InefficientFilter.
 */
async function fetchFromGraphFilter(token, days) {
  try {
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString();
    const filter = `receivedDateTime ge ${sinceDate} and (flag/flagStatus eq 'flagged' or importance eq 'high')`;

    const r = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=50&$select=subject,from,receivedDateTime,bodyPreview,webLink&$orderby=receivedDateTime desc&$filter=${encodeURIComponent(filter)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!r.ok) {
      if (r.status !== 400) return [];  // 400 = InefficientFilter, expected
      // Retry without $orderby when filter is combined with it
      const retryRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages?$top=50&$select=subject,from,receivedDateTime,bodyPreview,webLink&$filter=${encodeURIComponent(filter)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!retryRes.ok) return [];
      const data = await retryRes.json();
      return (data.value || []).map(m => ({
        subject: m.subject,
        from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown',
        received: m.receivedDateTime,
        preview: (m.bodyPreview || '').slice(0, 200),
        url: m.webLink,
        source: 'Level Up (Graph)',
        flagged_at: m.receivedDateTime
      }));
    }

    const data = await r.json();
    return (data.value || []).map(m => ({
      subject: m.subject,
      from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown',
      received: m.receivedDateTime,
      preview: (m.bodyPreview || '').slice(0, 200),
      url: m.webLink,
      source: 'Level Up (Graph)',
      flagged_at: m.receivedDateTime
    }));
  } catch (e) {
    console.error('Graph filter error:', e.message);
    return [];
  }
}

export default async function handler(req, res) {
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const fresh = await authenticateRequest(req, res, FLAGGED_SCOPE);
  if (!fresh) return;

  try {
    const days = parseInt(req.query.days || '14');

    // 1. Primary: To Do flaggedEmails list (reliable)
    const todoItems = await fetchFromTodoList(fresh.access_token);
    const seenKeys = new Set();
    todoItems.forEach(item => {
      seenKeys.add(item.subject + '|' + item.received);
    });

    // 2. Fallback: Graph filter (supplemental, deduplicated)
    const graphItems = await fetchFromGraphFilter(fresh.access_token, days);
    const dedupedGraph = graphItems.filter(item => {
      const key = item.subject + '|' + item.received;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    // 3. Merge with stored MFP flagged emails
    const mfpActions = storedData?.actions || [];
    const merged = [
      ...mfpActions.map(a => ({
        subject: a.subject,
        from: a.from || 'MFP',
        received: a.received || a.date,
        preview: (a.bodyPreview || a.body || '').slice(0, 200),
        url: a.url || '',
        source: a.source || 'MFP (Local)',
        flagged_at: a.flagged_at || a.received || a.date
      })),
      ...todoItems,
      ...dedupedGraph
    ];

    // Sort by received date descending
    merged.sort((a, b) => new Date(b.received || 0) - new Date(a.received || 0));

    res.json({
      value: merged,
      actions: merged,
      todo_count: todoItems.length,
      graph_count: graphItems.length,
      stored_count: mfpActions.length,
      total: merged.length,
      stored_at: storedData?._storedAt || null
    });
  } catch (e) {
    console.error('Flagged API exception:', e.message);
    res.status(500).json({ error: e.message });
  }
}