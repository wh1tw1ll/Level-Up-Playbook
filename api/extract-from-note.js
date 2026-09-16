// api/extract-from-note.js
// POST /api/extract-from-note
// Takes { text, parentRowId, sheetId }
// Returns { hasCommitment, proposedTask } or { hasCommitment: false }

const SHEET_ID_PROJECT = '4456864287772548';
const SHEET_ID_PERSONAL = '2802755367554948';

// Commitment detection patterns (all lowercase input)
// A commitment = named party + specific action + trigger/when
const commitmentPatterns = [
  // "talked to x, (and) he needs y" — most specific, must come before generic
  /talk(?:ed|ing)?\s+(?:to|with)\s+([a-z]+(?:\s+[a-z]+)?)[,.]?(?:\s+and\s+)?\s*(?:he|she|they)\s+(?:need(?:s|ed)?|said|wants?)\s+(.+?)(?:\.|$)/,
  // "x to y by z" — strongest signal for direct commitments
  /([a-z]+(?:\s+[a-z]+)?)\s+to\s+(.+?)(?:\s+by\s+|before\s+|for\s+)(.+?)(?:\.|$)/,
  // "x needs to y" or "x needs y"
  /([a-z]+(?:\s+[a-z]+)?)\s+need(?:s|ed)?\s+(?:to\s+)?(.+?)(?:\.|$)/,
  // "x will y"
  /([a-z]+(?:\s+[a-z]+)?)\s+will\s+(.+?)(?:\.|$)/,
  // "x going to y"
  /([a-z]+(?:\s+[a-z]+)?)\s+(?:is\s+)?going\s+to\s+(.+?)(?:\.|$)/,
  // "remind me/us to y"
  /remind\s+(?:me|us)\s+to\s+(.+?)(?:\.|$)/,
  // "i need to y by z"
  /i\s+need\s+to\s+(.+?)(?:\s+by\s+|before\s+)(.+?)(?:\.|$)/,
  // "confirm x with y by z"
  /confirm\s+(.+?)\s+with\s+([a-z]+(?:\s+[a-z]+)?)(?:\s+by\s+|before\s+)?(.+?)?(?:\.|$)/,
  // "check on x" or "look into x"
  /(?:check|look)\s+(?:on|into)\s+(.+?)(?:\.|$)/,
  // "follow up with x on y"
  /follow\s+up\s+with\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:on\s+)?(.+?)(?:\.|$)/,
  // "send x to y"
  /send\s+(.+?)\s+to\s+([a-z]+(?:\s+[a-z]+)?)(?:\.|$)/,
  // "get x from y" or "ask y for x"
  /(?:get|ask)\s+(.+?)\s+(?:from|for)\s+([a-z]+(?:\s+[a-z]+)?)(?:\.|$)/,
];

// Simple action verb detection
function hasActionVerb(text) {
  const verbs = /\b(send|provid|review|updat|submi|confir|follow|call|email|check|look|get|ask|coordinat|schedul|prepar|draft|share|forward|circulat|resolv|clarif|add|track|monitor|verif|reach|respond|repl|deliver|complet|finish|handl|manag|need|discuss|align|rout|mak|work|giv|bring|coordinat|prepar|report|collect|gather|document|research|investigat|resolv|clos|mov|push|build|creat|set|establish|confirm|send|forward|circulat|distribut|submi|file|order|arrang|set up|put|place|writ|draw|design|sign|approv|authoriz|release|deploy|launch|run|execut|perform|conduct|lead|organiz|plan|develop|implement|test|validat|check|certif|inspect|audit)[a-z]*\b/i;
  return verbs.test(text);
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const lowerText = text.toLowerCase();

  // Try commitment patterns first — they're specific enough
  for (const pattern of commitmentPatterns) {
    const match = pattern.exec(lowerText);
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
      } else if (pattern.source.includes('talk')) {
              // Talked to X, he needs Y
              party = match[1];
              action = match[2] || '';
            } else if (pattern.source.includes('remind')) {
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
        taskText = `${titleCase(party)} ${action}`.trim();
      }
      if (timing && !taskText.toLowerCase().includes(timing.toLowerCase())) {
        taskText += ` by ${titleCase(timing)}`;
      }
      taskText = titleCase(taskText);

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