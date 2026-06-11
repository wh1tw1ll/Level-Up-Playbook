// lib/handlers/flagged-store.js — Receives flagged emails from local Outlook COM sync script
// In-memory store consumed by the flagged handler

let storedData = null;
let storedTimestamp = null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // POST: Accept flagged data from local sync script
  if (req.method === 'POST') {
    const syncKey = req.headers['x-sync-key'];
    const expectedKey = process.env.LU_FLAG_SYNC_KEY;
    if (!expectedKey || syncKey !== expectedKey) {
      return res.status(401).json({ error: 'Invalid sync key' });
    }
    try {
      const body = req.body;
      if (!body || !Array.isArray(body.actions)) {
        return res.status(400).json({ error: 'Invalid payload: actions array required' });
      }
      storedData = body;
      storedTimestamp = new Date().toISOString();
      return res.json({ status: 'ok', count: body.actions.length, stored_at: storedTimestamp });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET: Return stored data (used by flagged handler or debugging)
  if (req.method === 'GET') {
    return res.json({
      has_data: storedData !== null,
      count: storedData ? storedData.actions.length : 0,
      stored_at: storedTimestamp,
      source: storedData ? storedData.source : null,
      actions: storedData ? storedData.actions : []
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}