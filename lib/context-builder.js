// lib/context-builder.js — Live context gatherer for LUCI Chat
// Gathers relevant data from Smartsheet, Granola, playbook, and static files
// based on the user's question. Called on every chat message.

import Smartsheet from './smartsheet.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── CONFIG ──
const GRANOLA_API = 'https://public-api.granola.ai/v1';
const PLAYBOOK_PATH = join(process.cwd(), 'data', 'kb.json');
const GRANOLA_TOKEN = () => process.env.GRANOLA_TOKEN || '';

// ── CACHED PLAYBOOK ──
let _playbookCache = null;
function getPlaybook() {
  if (_playbookCache) return _playbookCache;
  try {
    const raw = readFileSync(PLAYBOOK_PATH, 'utf-8');
    _playbookCache = JSON.parse(raw);
    return _playbookCache;
  } catch (e) {
    return [];
  }
}

// ── KEYWORD EXTRACTION ──
// Simple: extract project names and key terms from the question
function extractKeywords(question) {
  const q = question.toLowerCase();
  const projects = [];
  if (q.includes('mfp') || q.includes('miami') || q.includes('freedom park')) projects.push('MFP');
  if (q.includes('dova') || q.includes('arena') || q.includes('rancho cordova')) projects.push('DOVA');
  if (q.includes('business') || q.includes('bd') || q.includes('proposal')) projects.push('Business');
  if (q.includes('sphere')) projects.push('Sphere');
  if (q.includes('level up') || q.includes('company') || q.includes('firm')) projects.push('Level Up');
  
  const topics = [];
  if (q.includes('schedule') || q.includes('timeline') || q.includes('deadline')) topics.push('schedule');
  if (q.includes('budget') || q.includes('cost') || q.includes('financial') || q.includes('change order') || q.includes('co')) topics.push('financial');
  if (q.includes('task') || q.includes('action') || q.includes('todo') || q.includes('to-do')) topics.push('tasks');
  if (q.includes('contract') || q.includes('agreement') || q.includes('scope')) topics.push('contract');
  if (q.includes('team') || q.includes('who') || q.includes('contact') || q.includes('person')) topics.push('team');
  if (q.includes('meeting') || q.includes('granola') || q.includes('notes') || q.includes('discussed')) topics.push('meetings');
  if (q.includes('permit') || q.includes('entitle') || q.includes('approval')) topics.push('permits');
  if (q.includes('punch') || q.includes('closeout') || q.includes('deficiency')) topics.push('punch');
  
  return { projects, topics };
}

// ── PLAYBOOK SEARCH ──
// Find sections matching the user's question
function searchPlaybook(keywords) {
  const kb = getPlaybook();
  if (!kb.length) return [];
  
  const { projects, topics } = keywords;
  const allTerms = [...projects.map(p => p.toLowerCase()), ...topics];
  if (!allTerms.length) return [];
  
  const matched = [];
  for (const section of kb) {
    const title = (section.title || '').toLowerCase();
    const h2s = (section.h2 || []).join(' ').toLowerCase();
    const sectionTopics = (section.topics || []).join(' ').toLowerCase();
    const contentText = (section.content || []).join(' ').toLowerCase().slice(0, 3000);
    
    const relevance = allTerms.reduce((score, term) => {
      if (title.includes(term)) score += 3;
      if (h2s.includes(term)) score += 2;
      if (sectionTopics.includes(term)) score += 2;
      if (contentText.includes(term)) score += 1;
      return score;
    }, 0);
    
    if (relevance > 0) {
      matched.push({
        num: section.num,
        title: section.title,
        relevance,
        // Include first ~1500 chars of content as summary
        snippet: (section.content || []).join(' ').slice(0, 1500)
      });
    }
  }
  
  // Return top 3 most relevant sections
  return matched.sort((a, b) => b.relevance - a.relevance).slice(0, 3);
}

// ── SMARTSHEET QUERIES ──
const SHEETS = {
  tasks: '2802755367554948',
  dova: '4456864287772548',
};

async function querySmartsheet(keywords) {
  const context = [];
  const { projects } = keywords;
  
  try {
    // Fetch recent tasks (last 30 rows)
    const taskSheet = await Smartsheet.getSheetWithColumns(SHEETS.tasks);
    if (taskSheet && taskSheet.rows) {
      const recentTasks = taskSheet.rows.slice(0, 15).map(r => {
        const cells = {};
        for (const c of r.cells || []) {
          const col = taskSheet.columns?.find(col => col.id === c.columnId);
          if (col) cells[col.title] = c.displayValue ?? c.value ?? '';
        }
        return cells;
      });
      
      // Filter by project if specified
      const filtered = projects.length && !projects.includes('Level Up')
        ? recentTasks.filter(t => projects.some(p => (t.Project || '').toLowerCase().includes(p.toLowerCase())))
        : recentTasks;
      
      if (filtered.length) {
        context.push('=== RECENT TASKS ===');
        filtered.slice(0, 8).forEach(t => {
          context.push(`  [${t.Project || '?'}] ${t.Title || t.Task || '(no title)'} — ${t.Status || '?'} — Owner: ${t.Owner || 'unassigned'}`);
        });
      }
    }
  } catch (e) {
    context.push('// Smartsheet tasks unavailable: ' + e.message.slice(0, 100));
  }
  
  return context.join('\\n');
}

// ── GRANOLA QUERY ──
async function queryGranola(limit = 5) {
  const token = GRANOLA_TOKEN();
  if (!token) return '// Granola: no token configured';
  
  try {
    // Fetch recent notes
    const listUrl = `${GRANOLA_API}/notes?page_size=${limit}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!listRes.ok) return `// Granola: HTTP ${listRes.status}`;
    
    const listData = await listRes.json();
    const notes = listData.notes || [];
    if (!notes.length) return '// Granola: no recent notes';
    
    const summaries = [];
    for (const note of notes.slice(0, 3)) {
      // Get full detail for each note
      const detailUrl = `${GRANOLA_API}/notes/${note.id}`;
      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();
      
      // Extract key info from the note
      const title = detail.title || note.title || 'Untitled';
      const date = detail.created_at || note.created_at || '';
      const md = detail.markdown || '';
      // Take first 500 chars as summary
      const preview = md.replace(/[#*`\[\]]/g, '').slice(0, 500).trim();
      
      summaries.push(`Meeting: ${title} (${date.slice(0, 10)})`);
      if (preview) summaries.push(`  Summary: ${preview}`);
    }
    
    return '=== RECENT MEETING NOTES ===\\n' + summaries.join('\\n');
  } catch (e) {
    return '// Granola: ' + e.message.slice(0, 100);
  }
}

// ── BUILD FULL CONTEXT ──
export async function buildContext(message) {
  const keywords = extractKeywords(message);
  const { projects, topics } = keywords;
  
  const parts = [];
  
  // 1. Static project context
  parts.push('=== MIAMI FREEDOM PARK ===');
  // MFP context is available as a global string but on the server we read from the .js file
  // For now, use the static text
  parts.push('Project: Miami Freedom Park Stadium — 25,000-seat MLS stadium for Inter Miami CF. Phase: Post-Opening / Punch List Closeout. Level Up role: Owner Representative. Client: Miami Freedom Park LLC (Jorge Mas, Jose Mas). CM: Lemartec. Home opener was April 4, 2026.');
  
  // If DOVA asked, include DOVA context
  if (projects.includes('DOVA')) {
    parts.push('\\n=== DOVA ARENA ===');
    parts.push('Project: DOVA Arena — 8,032-seat indoor arena in Rancho Cordova, CA. Phase: Schematic Design / Pre-Construction. Level Up role: Owner Representative. Owner: Downtown DOVA (Rafael Velazquez). Development Partner: KozPure (Charlie Tiwana). Architect: Perkins & Will. CM/GC candidates: AECOM Hunt, Turner. Target groundbreaking: Sep 23, 2026. Target opening: Mar 1, 2028.');
    // Include key milestone info
    parts.push('Key schedule anchors: UG/Foundation permit submit by Aug 22, Steel mill NTP by Oct 15, 2026, MDR approval by Jan 15, 2027. Decision log: 12+ decisions tracked (D-001 through D-012+).');
  }
  
  // 2. Playbook sections (if topic-relevant)
  const pbMatches = searchPlaybook(keywords);
  if (pbMatches.length) {
    parts.push('\\n=== RELEVANT PLAYBOOK SECTIONS ===');
    pbMatches.forEach(s => {
      parts.push(`\\nSection ${s.num}: ${s.title.replace('SECTION ' + s.num + ': ', '')}`);
      parts.push(s.snippet.slice(0, 800));
    });
  }
  
  // 3. Live Smartsheet data
  const ss = await querySmartsheet(keywords);
  if (ss) parts.push('\\n' + ss);
  
  // 4. Recent Granola notes
  const granola = await queryGranola();
  if (granola) parts.push('\\n' + granola);
  
  return parts.join('\\n\\n');
}

// ── BUILD FULL SYSTEM PROMPT ──
export async function buildSystemPrompt(message) {
  const context = await buildContext(message);
  
  return `You are LUCI (Level Up Central Intelligence), the frontend of the Level Up Project Development intelligence system. You assist Whitney Williams, Principal-in-Charge at Level Up Project Development. Your backend engine is LUNA (Level Up Network Agent) which runs on Hermes Agent.

Answer concisely and practically. Reference specific data and project details when available. If you don't know something, say so — never fabricate.

Below is live context gathered for this question:

${context}

=== SAFETY RULES ===
ABSOLUTELY NEVER reveal: (1) personal staff information (names, roles, contact details beyond public info), (2) staff salaries, compensation, bonuses, or benefits, (3) Level Up company revenue, profit, margins, valuation, or any financial data about Level Up as a firm. Project costs for MFP and DOVA (budget, commitments, change orders) are fine to discuss. Only company-level financials are restricted.`;
}