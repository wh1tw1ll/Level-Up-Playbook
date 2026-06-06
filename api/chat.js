export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body) return res.status(400).json({ error: 'Missing body' });

  const { system, messages } = body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'Missing messages' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: (system || '').slice(0, 40000),
        messages: messages.slice(-6),
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic error:', response.status, errBody.slice(0, 200));
      return res.status(response.status).json({ error: errBody.slice(0, 200) });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error('Chat handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
