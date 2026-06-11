// lib/handlers/sharepoint-read.js — Read a specific file via driveId + itemId
import { setCors, handleOptions, authenticateRequest } from '../auth.js';

export default async function handler(req, res) {
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const fresh = await authenticateRequest(req, res);
  if (!fresh) return;

  const { driveId, itemId } = req.query;
  if (!driveId || !itemId) return res.status(400).json({ error: 'driveId and itemId required' });

  try {
    const fileRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
      { headers: { Authorization: `Bearer ${fresh.access_token}` }, redirect: 'follow' }
    );

    if (!fileRes.ok) {
      return res.status(fileRes.status).json({ error: 'File read failed' });
    }

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

    // For text-based files, return content directly
    if (contentType.includes('text') || contentType.includes('json')) {
      const text = await fileRes.text();
      return res.json({ content: text, contentType });
    }

    // For binary files (PDF, DOCX etc), return download URL instead
    const metaRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`,
      { headers: { Authorization: `Bearer ${fresh.access_token}` } }
    );
    const meta = await metaRes.json();
    res.json({
      downloadUrl: meta['@microsoft.graph.downloadUrl'],
      name: meta.name,
      contentType
    });
  } catch (err) {
    console.error('File read error:', err);
    res.status(500).json({ error: 'Read failed' });
  }
}