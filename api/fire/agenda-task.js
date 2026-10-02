// api/fire/agenda-task.js — Vercel serverless endpoint
// Fires the Anthropic scheduled task for on-demand agenda generation
import handler from '../../lib/handlers/fire-agenda.js';
export default handler;