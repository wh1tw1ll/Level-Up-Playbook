// lib/handlers/extract-emails.js
// POST /api/extract-emails
// Body: { messages: [{ id, sender, to, subject, body, date, folder }] }
// Auth: x-service-key header (SMARTSHEET_TOKEN)
// Returns: { results: [{ messageId, items: [{ text, owner, confidence, evidenceQuote }] }] }

const ANTH_BASE = 'https://api.anthropic.com/v1';

function authenticate(req, res) {
  const key = req.headers?.['x-service-key'] || req.headers?.['X-Service-Key'] || '';
  const expected = process.env.STAGE_SERVICE_KEY || 'ChRJVBkqJEaha5mLiDYGn3WCzE79I9yNkmEID';
  if (!expected || key !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!authenticate(req, res)) return;

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const messages = body.messages || [];
  if (messages.length === 0) return res.json({ results: [] });

  const allResults = [];
  const CHUNK_SIZE = 5;

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    const result = await processChunk(chunk);
    allResults.push(...result);
  }

  return res.json({ results: allResults });
}

async function processChunk(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return messages.map(m => ({ messageId: m.id, error: 'ANTHROPIC_API_KEY not configured' }));
  }

  let userPrompt = 'Extract action items from these messages:\n\n';
  for (const m of messages) {
    userPrompt += `--- MESSAGE ${m.id} ---\n`;
    userPrompt += `Sender: ${m.sender}\nTo: ${m.to}\n`;
    userPrompt += `Subject: ${m.subject}\nDate: ${m.date}\n`;
    userPrompt += `Body:\n${(m.body || '').substring(0, 3000)}\n\n`;
  }

  const systemPrompt = `You are a project management assistant that extracts action items from email messages.

For each message, determine if it contains action items — commitments, requests, or follow-ups someone needs to do. If purely informational, return an empty items array.

For each action item found, extract:
1. **text**: Rewrite as "[Party] to [verb] [specific deliverable] [context/deadline]". Replace pronouns with actual names based on sender, recipient, and context.
2. **owner**: The person responsible. For "I will" → sender. For "can you" → recipient. For sent items from Whitney asking others → "Whitney Williams" (follow-up). For unclear → "TBD".
3. **confidence**: "Medium" for explicit commitments/direct requests. "Low" if inferred or vague.
4. **evidenceQuote**: EXACT 1-2 sentences from the message supporting this item. Verbatim. If no sentence supports it, DO NOT extract the item.

DO NOT extract: "Attached is...", FYIs, thanks, scheduling chatter, past-tense statements about what someone else already did.

For Sent Items: Whitney's requests to others ("can you send", "please share") → "Whitney Williams to follow up with [recipient] for [deliverable]". Skip if recipient already replied. Whitney's own commitments ("I will send") → Whitney Williams items.

Owner rules: Single owner only. Directed-at requests → the asked party. Unknown → TBD. Never guess.

Return valid JSON array only. Each object: { messageId (matching input), items: [{text, owner, confidence, evidenceQuote}] } or empty array.`;

  try {
    const antReq = await fetch(`${ANTH_BASE}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250608',
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 4096,
      }),
    });

    if (!antReq.ok) {
      const errText = await antReq.text();
      return messages.map(m => ({ messageId: m.id, error: `Anthropic ${antReq.status}: ${errText.substring(0,200)}` }));
    }

    const antData = await antReq.json();
    const content = antData?.content?.[0]?.text || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return messages.map(m => ({ messageId: m.id, error: 'No JSON in response' }));
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return messages.map(m => ({ messageId: m.id, error: 'Invalid JSON in response' }));
    }
  } catch (e) {
    return messages.map(m => ({ messageId: m.id, error: e.message }));
  }
}

export const config = { maxDuration: 120 };