// api/index.js — Single catch-all Vercel function replacing 11 separate handlers
// Routes based on req.url (rewritten from /api/(.*) → /api/ via vercel.json)

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

// Initialize flagged handler's in-memory store (cold start)
setStoredData({ actions: [], _storedAt: null });

// Wrap flagged-store POST to also update flagged handler's store
const originalFlaggedStoreHandler = flaggedStore;
const wrappedFlaggedStore = async (req, res) => {
  if (req.method === 'POST') {
    const origJson = res.json.bind(res);
    res.json = (data) => {
      setStoredData({
        actions: req.body?.actions || [],
        source: req.body?.source || 'MFP (Local)',
        _storedAt: new Date().toISOString()
      });
      return origJson(data);
    };
  }
  return originalFlaggedStoreHandler(req, res);
};

function parsePath(path) {
  // path comes from ?path=$1 query param in rewrite
  // Guard against array values
  const p = Array.isArray(path) ? path[0] : path;
  return '/api/' + (p || '').replace(/\/$/, '');
}

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
    case '/api/sync/flagged-store':
      return wrappedFlaggedStore(req, res);
    case '/api/outlook/flagged':
      return flaggedHandler(req, res);
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
    default:
      if (path === '/api/oauth' || path.startsWith('/api/oauth/')) {
        return oauthHandler(req, res);
      }
      res.status(404).json({ error: 'Route not found', path });
  }
}

export const config = {
  maxDuration: 30
};