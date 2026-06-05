// api/sharepoint/read.js — reads a specific file via driveId + itemId
export default async function handler(req, res) {
  const cookie = req.cookies?.lu_auth;
  if (!cookie) return res.status(401).json({ error: 'Not authenticated' });

  let tokenData;
  try {
    tokenData = JSON.parse(decodeURIComponent(cookie));
  } catch {
    return res.status(401).json({ error: 'Invalid auth' });
  }

  const { driveId, itemId } = req.query;
  if (!driveId || !itemId) return res.status(400).json({ error: 'driveId and itemId required' });

  try {
    const fileRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        redirect: 'follow',
      }
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
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const meta = await metaRes.json();
    res.json({
      downloadUrl: meta['@microsoft.graph.downloadUrl'],
      name: meta.name,
      contentType,
    });
  } catch (err) {
    console.error('File read error:', err);
    res.status(500).json({ error: 'Read failed' });
  }
}
