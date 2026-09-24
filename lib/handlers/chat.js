// lib/handlers/chat.js — LUCI Chat with live context
// Receives { message, history } from frontend, gathers live project data,
// builds a rich system prompt, and sends to OpenRouter.

import { buildSystemPrompt } from '../context-builder.js';

const MODEL = () => process.env.CHAT_MODEL || 'deepseek/deepseek-chat';

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

  const { message, history } = body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  try {
    // Build live context from all data sources
    const system = await buildSystemPrompt(message);

    // Build OpenRouter messages
    const openRouterMessages = [];
    openRouterMessages.push({ role: 'system', content: system.slice(0, 32000) });

    // Add conversation history (last 6 messages)
    if (history && history.length) {
      history.slice(-6).forEach(m => {
        openRouterMessages.push({ role: m.role || 'user', content: m.content });
      });
    }

    // Add the current question
    openRouterMessages.push({ role: 'user', content: message });

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
        max_tokens: 1500,
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
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message });
  }
}