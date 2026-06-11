// lib/handlers/action-items.js — Fetch last 21 days of emails via Graph API
import { setCors, handleOptions, authenticateRequest } from '../auth.js';

export default async function handler(req, res) {
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const fresh = await authenticateRequest(req, res);
  if (!fresh) return;

  const limit = Math.min(parseInt(req.query.limit || '100'), 200);
  const days = parseInt(req.query.days || '21');
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$select=subject,from,receivedDateTime,bodyPreview,isRead,webLink&$orderby=receivedDateTime desc&$filter=receivedDateTime ge ${sinceDate}`,
      { headers: { Authorization: `Bearer ${fresh.access_token}` } }
    );
    if (!r.ok) {
      const errText = await r.text().catch(() => 'Unknown error');
      return res.status(r.status).json({ error: `Graph API error: ${r.status}`, detail: errText.slice(0, 500) });
    }
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}