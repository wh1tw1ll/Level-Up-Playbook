// api/index.js — Catch-all with token-cached auth (the real perf win)
// Static imports are fine — auth.js token caching saves 500-800ms per request

import checkAuth from '../lib/handlers/check-auth.js';
import verifyPassword from '../lib/handlers/verify-password.js';
import chatHandler from '../lib/handlers/chat.js';
import flaggedStore from '../lib/handlers/flagged-store.js';
import actionItems from '../lib/handlers/action-items.js';
import emailHandler from '../lib/handlers/email.js';
import calendarHandler from '../lib/handlers/calendar.js';
import flaggedHandler, { setStoredData } from '../lib/handlers/flagged.js';
import sharepointSearch from '../lib/handlers/sharepoint-search.js';
import sharepointRead from '../lib/handlers/sharepoint-read.js';
import oauthHandler from '../lib/handlers/oauth.js';
import chiefsHandler from '../lib/handlers/chiefs.js';

// Module-level flagged store cache (survives warm instances)
let _flaggedCache = null;
setStoredData({ actions: [], _storedAt: null });

export default function handler(req, res) {
  const path = parsePath(req.query.path);

  // OAuth routes (called via vercel rewrites /auth/* → /api/oauth?...)
  if (req.query.provider) {
    return oauthHandler(req, res);
  }

  // Route by path
  switch (path) {
    case '/api/check-auth':
      return checkAuth(req, res);
    case '/api/verify-password':
      return verifyPassword(req, res);
    case '/api/chat':
      return chatHandler(req, res);
    case '/api/sync/flagged-store': {
      // Intercept POST to also update flagged handler's in-memory store
      if (req.method === 'POST') {
        _flaggedCache = {
          actions: req.body?.actions || [],
          source: req.body?.source || 'MFP (Local)',
          _storedAt: new Date().toISOString()
        };
        setStoredData(_flaggedCache);
      }
      return flaggedStore(req, res);
    }
    case '/api/outlook/flagged': {
      // Inject cached MFP data on cold start
      if (_flaggedCache) {
        setStoredData(_flaggedCache);
      }
      return flaggedHandler(req, res);
    }
    case '/api/outlook/action-items':
      return actionItems(req, res);
    case '/api/outlook/email':
      return emailHandler(req, res);
    case '/api/outlook/calendar':
      return calendarHandler(req, res);
    case '/api/sharepoint/search':
      return sharepointSearch(req, res);
    case '/api/sharepoint/read':
      return sharepointRead(req, res);
    case '/api/chiefs':
      return chiefsHandler(req, res);
    default:
      if (path === '/api/oauth' || path.startsWith('/api/oauth/')) {
        return oauthHandler(req, res);
      }
      res.status(404).json({ error: 'Route not found', path });
  }
}

function parsePath(path) {
  const p = Array.isArray(path) ? path[0] : path;
  return '/api/' + (p || '').replace(/\/$/, '');
}

export const config = {
  maxDuration: 30
};