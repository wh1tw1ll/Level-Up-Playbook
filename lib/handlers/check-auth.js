// lib/handlers/check-auth.js — Validates session cookie for password gate bypass
import { parseCookies, setCors, handleOptions } from '../auth.js';

export default function handler(req, res) {
  setCors(res, 'https://level-up-playbook.vercel.app');
  if (handleOptions(req, res)) return;

  const cookies = parseCookies(req);

  // Check lu_session cookie (non-HttpOnly, set by OAuth callback)
  const session = cookies['lu_session'];
  if (session) {
    try {
      const data = JSON.parse(decodeURIComponent(session));
      if (data.authenticated && data.expires_at && Date.now() < data.expires_at) {
        return res.json({ authed: true });
      }
    } catch (e) { /* ignore parse errors */ }
  }

  // Fallback: check lu_site_auth (password gate cookie)
  const siteAuth = cookies['lu_site_auth'];
  if (siteAuth) {
    try {
      const data = JSON.parse(decodeURIComponent(siteAuth));
      if (data.authed && data.expires_at && Date.now() < data.expires_at) {
        return res.json({ authed: true });
      }
    } catch (e) { /* ignore parse errors */ }
  }

  return res.json({ authed: false });
}