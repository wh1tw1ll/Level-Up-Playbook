// api/sharepoint/search.js — proxies MS Graph search with stored token
export default async function handler(req, res) {
  const cookie = req.cookies?.lu_auth;
  if (!cookie) return res.status(401).json({ error: 'Not authenticated' });

  let tokenData;
  try {
    tokenData = JSON.parse(decodeURIComponent(cookie));
  } catch {
    return res.status(401).json({ error: 'Invalid auth' });
  }

  if (Date.now() > tokenData.expires_at) {
    return res.status(401).json({ error: 'Token expired', reauth: true });
  }

  const { query, limit = 10, fileType } = req.method === 'POST'
    ? req.body
    : req.query;

  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    // Use MS Graph Search API
    const searchBody = {
      requests: [{
        entityTypes: ['driveItem', 'listItem'],
        query: { queryString: query },
        from: 0,
        size: Math.min(Number(limit), 25),
        fields: ['name', 'webUrl', 'lastModifiedDateTime', 'size', 'parentReference'],
        ...(fileType && { contentSources: [] }),
      }],
    };

    const searchRes = await fetch('https://graph.microsoft.com/v1.0/search/query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    const data = await searchRes.json();
    res.json(data);
  } catch (err) {
    console.error('SharePoint search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
}
