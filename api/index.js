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
import chiefsV3Handler from '../lib/handlers/chiefs-v3.js';
import ssOpsHandler from './ss-ops.js';
import tasksHandler from './tasks.js';
import dovaHandler from '../lib/handlers/dova.js';
import dovaDashboardHandler from '../lib/handlers/dova-dashboard.js';
import dovaSetupHandler from '../lib/handlers/dova-setup.js';
import dovaSeedHandler from '../lib/handlers/dova-seed.js';
import dovaWorkspaceHandler from '../lib/handlers/dova-workspace.js';
import dovaUpdateSchedule from '../lib/handlers/dova-update-schedule.js';

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
    case '/api/chiefs/admin':
      return chiefsHandler(req, res);
    case '/api/chiefs-v3':
      return chiefsV3Handler(req, res);
    case '/api/ss-ops':
      return ssOpsHandler(req, res);
    case '/api/tasks':
              return tasksHandler(req, res);
            case '/api/create-personal-sheet':
          return createPersonalSheet(req, res);
            case '/api/dova':
      return dovaHandler(req, res);
    case '/api/dova-dashboard':
      return dovaDashboardHandler(req, res);
    case '/api/dova-setup':
      return dovaSetupHandler(req, res);
    case '/api/dova-seed':
      return dovaSeedHandler(req, res);
    case '/api/dova-workspace':
      return dovaWorkspaceHandler(req, res);
    case '/api/dova-update-schedule':
      return dovaUpdateSchedule(req, res);
    default:
          // Pass through tasks sub-routes (e.g. /api/tasks/12345/discussions)
          if (path.startsWith('/api/tasks/')) {
            const origPath = req.query.path ? '/api/' + req.query.path : path;
            req.url = origPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
            return tasksHandler(req, res);
          }
          res.status(404).json({ error: 'Route not found', path });
  }
}

function parsePath(path) {
  const p = Array.isArray(path) ? path[0] : path;
  return '/api/' + (p || '').replace(/\/$/, '');
}

export const config = {
  maxDuration: 60
};

// ── CREATE PERSONAL SHEET ──
async function createPersonalSheet(req, res) {
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(500).json({ error: 'Token not set' });

  try {
    // Check if personal sheet already exists
    const listResp = await fetch('https://api.smartsheet.com/2.0/sheets?includeAll=true', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const listData = await listResp.json();
    const mySheet = (listData.data || []).find(s =>
      s.name && s.name.toLowerCase().includes('personal') && s.owner === 'Whitney Williams'
    );
    if (mySheet) {
      return res.json({ sheetId: mySheet.id, name: mySheet.name, existing: true });
    }

    // Define columns directly (mirrors project log structure - manual inspection)
        const columns = [
          { title: 'Action ID', type: 'TEXT_NUMBER', primary: true },
          { title: 'Owner', type: 'PICKLIST', options: ['Whitney Williams', 'Greg Wieting', 'Jordan Ward', 'TBD'] },
          { title: 'Status', type: 'PICKLIST', options: ['Not Started', 'In Progress', 'Complete', 'Archived'] },
          { title: 'Due Date', type: 'DATE' },
          { title: 'Project', type: 'PICKLIST', options: ['DOVA', 'MFP', 'Sphere', 'SPH', 'Business', 'General'] },
          { title: 'Category', type: 'TEXT_NUMBER' },
          { title: 'Responsible Firm(s)', type: 'TEXT_NUMBER' },
          { title: 'Hot Topic', type: 'CHECKBOX' },
          { title: 'Status Note', type: 'TEXT_NUMBER' },
          { title: 'Source', type: 'PICKLIST', options: ['Manual', 'Email', 'Notes'] },
          { title: 'SourceRef', type: 'TEXT_NUMBER' },
          { title: 'LinkedRowId', type: 'TEXT_NUMBER' },
          { title: 'Confidence', type: 'PICKLIST', options: ['High', 'Low'] }
        ];

    const createResp = await fetch('https://api.smartsheet.com/2.0/sheets', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'LUCI - Personal Action Log', columns })
    });
    const createData = await createResp.json();

    if (!createResp.ok) {
      return res.status(502).json({ error: 'Create failed', detail: createData });
    }

    res.json({ sheetId: createData.result.id, name: createData.result.name, existing: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}