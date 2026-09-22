// lib/handlers/agendas-store.js — In-memory agenda storage
// generate-agenda.mjs POSTs per-meeting agendas here.
// Prep tab reads them via GET /api/prep (prep.js includes them in response).
import { setCors, handleOptions } from '../auth.js';

let _agendas = [];

export function getStoredAgendas() {
  return _agendas;
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method === 'POST') {
    const body = req.body || {};
    const agendas = body.agendas || [];
    _agendas = agendas;
    console.log(`Agendas stored: ${agendas.length}`);
    return res.json({ ok: true, count: agendas.length });
  }

  if (req.method === 'GET') {
    return res.json({ agendas: _agendas });
  }

  res.status(405).json({ error: 'POST or GET only' });
}