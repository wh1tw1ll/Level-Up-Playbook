// api/sharepoint/search.js — proxies MS Graph search with stored token
export default async function handler(req, res) {
  // Parse cookies manually (Vercel doesn't auto-parse)
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k.trim(), v.join('=').trim()])
  );
  const cookie = cookies['lu_auth'];

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

  const query = req.method === 'POST' ? req.body?.query : req.query?.query;
  const limit = parseInt(req.method === 'POST' ? req.body?.limit : req.query?.limit) || 10;

  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const searchBody = {
      requests: [{
        entityTypes: ['driveItem'],
        query: { queryString: query },
        from: 0,
        size: Math.min(limit, 25),
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
