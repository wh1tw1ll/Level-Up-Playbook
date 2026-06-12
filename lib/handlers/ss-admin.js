// lib/handlers/ss-admin.js — Temporary Smartsheet admin endpoint (remove after use)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'SMARTSHEET_TOKEN not configured' });

  const { action, sheetId, columnName, columnType, options } = req.query;
  const base = 'https://api.smartsheet.com/2.0';

  try {
    if (action === 'addColumn') {
      const { index } = req.query;
      const body = [{ title: columnName, type: columnType === 'DROPDOWN' ? 'PICKLIST' : columnType, options: options ? options.split(',') : undefined, index: parseInt(index || '0') }];
      const r = await fetch(`${base}/sheets/${sheetId}/columns`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      return res.json({ ok: r.ok, status: r.status, data });
    }

    if (action === 'addRows') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
      const { rows } = body || {};
      if (!rows || !rows.length) return res.status(400).json({ error: 'rows required' });
      // rows should be [{ cells: [{ columnId: ..., value: ... }] }]
      const r = await fetch(`${base}/sheets/${sheetId}/rows`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(rows)
      });
      const data = await r.json();
      return res.json({ ok: r.ok, status: r.status, data });
    }

    if (action === 'getColumns') {
      const r = await fetch(`${base}/sheets/${sheetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await r.json();
      const cols = (data.columns || []).map(c => ({ id: c.id, title: c.title, type: c.type }));
      return res.json({ ok: true, columns: cols });
    }

    if (action === 'deleteRows') {
      const { rowIds } = req.body;
      if (!rowIds || !rowIds.length) return res.status(400).json({ error: 'rowIds required' });
      const ids = rowIds.join(',');
      const r = await fetch(`${base}/sheets/${sheetId}/rows?ids=${ids}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await r.json();
      return res.json({ ok: r.ok, status: r.status, data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}