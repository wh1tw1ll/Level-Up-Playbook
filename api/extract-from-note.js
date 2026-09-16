// api/extract-from-note.js
// POST /api/extract-from-note
// Takes { text, parentRowId, sheetId }
// Returns { hasCommitment, proposedTask } or { hasCommitment: false }

const SHEET_ID_PROJECT = '4456864287772548';
const SHEET_ID_PERSONAL = '2802755367554948';

// Commitment detection patterns
// A commitment = named party + specific action + trigger/when
const commitmentPatterns = [
  // "X to Y by Z" — strongest signal
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+(.+?)(?:\s+by\s+|before\s+|for\s+)(.+?)(?:\.|$)/i,
  // "X needs to Y" or "X needs Y"
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+need(?:s|ed)?\s+(?:to\s+)?(.+?)(?:\.|$)/i,
  // "X will Y" 
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+will\s+(.+?)(?:\.|$)/i,
  // "X going to Y"
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:is\s+)?going\s+to\s+(.+?)(?:\.|$)/i,
  // "he/she needs Y" with context
  /\b(?:he|she|they)\s+need(?:s|ed)?\s+(?:to\s+)?(.+?)(?:\.|$)/i,
  // "Talked to X, he needs Y"
  /talk(?:ed|ing)?\s+(?:to|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[,.]?(?:\s+and\s+)?\s*(?:he|she|they)\s+(?:need(?:s|ed)?|said|wants?)\s+(.+?)(?:\.|$)/i,
  // "Remind me to Y"
  /remind\s+(?:me|us)\s+to\s+(.+?)(?:\.|$)/i,
  // "I need to Y by Z"
  /[Ii]\s+need\s+to\s+(.+?)(?:\s+by\s+|before\s+)(.+?)(?:\.|$)/,
  // "Confirm X with Y by Z"
  /confirm\s+(.+?)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+by\s+|before\s+)?(.+?)?(?:\.|$)/i,
  // "Check on X" or "Look into X"
  /(?:check|look)\s+(?:on|into)\s+(.+?)(?:\.|$)/i,
  // "Follow up with X on Y"
  /follow\s+up\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:on\s+)?(.+?)(?:\.|$)/i,
  // "Send X to Y"
  /send\s+(.+?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\.|$)/i,
  // "Get X from Y" or "Ask Y for X"
  /(?:get|ask)\s+(.+?)\s+(?:from|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\.|$)/i,
];

// Simple action verb detection
function hasActionVerb(text) {
  const verbs = /\b(send|provide|review|update|submit|confirm|follow\s+up|call|email|check|look|get|ask|coordinate|schedule|prepare|draft|share|forward|circulate|resolve|clarify|add|track|monitor|verify|reach\s+out|respond|reply|deliver|complete|finish|handle|manage|need|provide|discuss|align|route|make|work|give|bring|discuss|coordinate|prepare|share|report|collect|gather|document|research|investigate|resolve|close|move|push|build|create|set|establish|confirm|send|forward|circulate|distribute|submit|file|order|arrange|set.up|put|place|write|draw|design|sign|approve|authorize|release|deploy|launch|run|execute|perform|conduct|lead|organize|plan|develop|implement|test|validate|check|certify|inspect|audit)\b/i;
  return verbs.test(text);
}

// Infer type like the widget's getTaskType
function inferType(text) {
  const t = text.trim().toLowerCase();
  const draftStart = /^(send|email|respond|reply|circulate|forward|follow\s+up|reach\s+out|confirm\s+with|write|draft|compose|contact|call|message|text)\b/;
  const trackStart = /^(track|monitor|review|verify|confirm\s+that|add\s+to|update)\b/;
  const draftAny = /\b(send|email|respond|reply|reach\s+out|contact|call|message|text)\b/;
  const trackAny = /\b(track|monitor|review|verify|confirm)\b/;
  if (draftStart.test(t)) return 'DRAFT';
  if (trackStart.test(t)) return 'TRACK';
  if (draftAny.test(t)) return 'DRAFT';
  if (trackAny.test(t)) return 'TRACK';
  return 'DO';
}

function extract(text, parentProject, parentFirm) {
  if (!text || text.trim().length < 15) return null; // Too short

  // Try commitment patterns first — they're specific enough
  for (const pattern of commitmentPatterns) {
    const match = pattern.exec(text);
    if (match) {
      // Quick action verb check for patterns that might be loose
      if (!hasActionVerb(text)) continue;
      // Extract named party and action
      let party = '';
      let action = '';
      let timing = '';

      // Different patterns have different capture groups
      if (pattern.source.includes('talk')) {
        // "Talked to X, he needs Y"
        party = match[1];
        action = match[2] || match[1];
      } else if (pattern.source.includes('confirm')) {
        // "Confirm X with Y"
        const what = match[1];
        party = match[2];
        action = `Confirm ${what} with ${party}`;
        timing = match[3] || '';
      } else if (pattern.source.includes('send')) {
        // "Send X to Y"
        const what = match[1];
        party = match[2];
        action = `Send ${what} to ${party}`;
      } else if (pattern.source.includes('get|ask')) {
        // "Get X from Y" or "Ask Y for X"
        const what = match[1];
        party = match[2];
        action = `${match[0].startsWith('ask') ? 'Ask' : 'Get'} ${what} ${match[0].includes('from') ? 'from' : 'for'} ${party}`;
      } else if (pattern.source.includes('follow\\s+up')) {
        party = match[1];
        action = `Follow up with ${party} on ${match[2] || ''}`;
      } else if (pattern.source.includes('remind')) {
        action = `Reminder: ${match[1]}`;
        party = '';
      } else if (pattern.source.includes('check|look')) {
        action = `Check on ${match[1]}`;
        party = '';
      } else if (pattern.source.includes('he|she|they')) {
        // Need to infer the party from context — use the last name before the pattern
        action = match[1] || '';
        party = '';
      } else if (pattern.source.includes('going\\s+to') || pattern.source.includes('will\\s+')) {
        party = match[1];
        action = match[2];
        // Check for timing
        const timingMatch = text.match(/\b(?:by|before)\s+(.+?)(?:\.|$)/i);
        if (timingMatch) timing = timingMatch[1];
      } else if (pattern.source.includes('need')) {
        party = match[1];
        action = match[2];
        const timingMatch = text.match(/\b(?:by|before)\s+(.+?)(?:\.|$)/i);
        if (timingMatch) timing = timingMatch[1];
      } else {
        party = match[1] || '';
        action = match[2] || match[1] || '';
        const timingMatch = text.match(/\b(?:by|before)\s+(.+?)(?:\.|$)/i);
        if (timingMatch) timing = timingMatch[1];
      }

      if (!action || action.trim().length < 5) continue;

      // Build proposed task text
      let taskText = action.trim();
      if (party) {
        taskText = `${party} ${action}`;
      }
      if (timing) {
        taskText += ` by ${timing}`;
      }

      return {
        actionItem: taskText.substring(0, 500),
        type: inferType(taskText),
        project: parentProject || 'DOVA',
        responsibleFirm: parentFirm || '',
        suggestedOwner: party || ''
      };
    }
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    let body;
    if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body); } catch { body = {}; }
    } else {
      body = req.body || {};
    }

    const text = body.text || '';
    const parentRowId = body.parentRowId || '';
    const parentProject = body.parentProject || '';
    const parentFirm = body.parentFirm || '';

    if (!text || text.trim().length < 15) {
      return res.json({ hasCommitment: false });
    }

    const proposed = extract(text, parentProject, parentFirm);

    if (proposed) {
      res.json({
        hasCommitment: true,
        proposedTask: proposed
      });
    } else {
      res.json({ hasCommitment: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 15 };