// lib/handlers/verify-password.js — Password verification gate
import { setCors, handleOptions } from '../auth.js';

const SITE_PASSWORD=process.env.SITE_PASSWORD || 'levelup2024';

export default function handler(req, res) {
  setCors(res, '*');
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  let password = (typeof body === 'string') ? body : body?.password;

  if (password === SITE_PASSWORD) {
    const payload = JSON.stringify({ authed: true, expires_at: Date.now() + 7 * 24 * 3600 * 1000 });
    res.setHeader('Set-Cookie', `lu_site_auth=${encodeURIComponent(payload)}; Path=/; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
    return res.json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid password' });
}