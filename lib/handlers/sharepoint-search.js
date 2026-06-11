// lib/handlers/sharepoint-search.js — Search SharePoint via Graph API
import { setCors, handleOptions, authenticateRequest } from '../auth.js';

export default async function handler(req, res) {
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const fresh = await authenticateRequest(req, res);
  if (!fresh) return;

  const query = req.query.q || req.query.query || '';
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/search/query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fresh.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          entityTypes: ['driveItem'],
          query: { queryString: query },
          from: 0,
          size: 20
        }]
      })
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => 'Unknown error');
      return res.status(r.status).json({
        error: `Graph API error: ${r.status}`,
        detail: errText.slice(0, 500)
      });
    }
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}