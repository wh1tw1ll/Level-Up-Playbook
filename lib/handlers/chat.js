// lib/handlers/chat.js — OpenRouter chat proxy via LUCI/LUNA
// Uses DeepSeek V3 (configurable via env MODEL) — fast, cheap, effective

const MODEL = () => process.env.CHAT_MODEL || 'deepseek/deepseek-chat';

const SYSTEM_PROMPT = `You are LUNA — the Level Up Project Development AI assistant.
You help the team answer questions about:
- Project data (contacts, contracts, financials, schedule)
- Miami Freedom Park (stadium, parking, retail, infrastructure)
- Construction project management best practices
- Level Up standard operating procedures

Keep answers concise and project-focused. Reference actual project data when available.
If you don't know something, say so. Never fabricate project-specific facts.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body) return res.status(400).json({ error: 'Missing body' });

  const { system, messages } = body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'Missing messages' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  const openRouterMessages = [];
  if (system) {
    openRouterMessages.push({ role: 'system', content: system.slice(0, 16000) });
  }
  (messages || []).slice(-6).forEach(m => {
    openRouterMessages.push({ role: m.role || 'user', content: m.content });
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://level-up-playbook.vercel.app',
        'X-Title': 'Level Up Playbook LUCI'
      },
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: 1000,
        temperature: 0.3,
        messages: openRouterMessages
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: errBody.slice(0, 200) });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message;
    return res.json({
      content: [{ text: reply ? reply.content : 'No response.' }]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}