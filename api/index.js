// api/index.js — Consolidated catch-all router
// All routes here: no new serverless functions created

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
import ssOpsHandler from '../lib/handlers/ss-ops.js';
import tasksHandler from '../lib/handlers/tasks.js';
import dispatchHandler from '../lib/handlers/dispatch.js';
import adminBatch from '../lib/handlers/admin-batch.js';
import dovaHandler from '../lib/handlers/dova.js';
import dovaSetupHandler from '../lib/handlers/dova-setup.js';
import dovaSeedHandler from '../lib/handlers/dova-seed.js';
import dovaWorkspaceHandler from '../lib/handlers/dova-workspace.js';
import dovaUpdateSchedule from '../lib/handlers/dova-update-schedule.js';
import prepHandler from '../lib/handlers/prep.js';
import stageHandler from '../lib/handlers/stage.js';
import promoteHandler from '../lib/handlers/promote.js';
import extractFromNote from '../lib/handlers/extract-from-note.js';
import prepMapHandler from '../lib/handlers/prep-map.js';
import graphProxy from '../lib/handlers/graph-proxy.js';
import smartsheet from '../lib/smartsheet.js';
import guardedWrite from '../lib/guarded-write.js';

import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCookies } from '../lib/auth.js';

// Module-level flagged store cache (survives warm instances)
let _flaggedCache = null;
setStoredData({ actions: [], _storedAt: null });

// ── HELPERS ──

const SHEETS = {
  personal: '2802755367554948',
  project: '4456864287772548',
};
const DOVA_SHEET = '4456864287772548';
const PROJECT_COL_TITLE = 'Project';
const PROJECT_COL_VALUE = 'DOVA';
// prepmap discovered dynamically via the prep-map handler

function findColId(cols, title) {
  return cols.find(c => c.title === title)?.id || null;
}

function getCellValue(row, colId) {
  return row.cells?.find(c => c.columnId === colId)?.displayValue 
    || row.cells?.find(c => c.columnId === colId)?.value 
    || '';
}

// ── AUTH GUARD — every route except verify-password, check-auth, and OAuth ──
const AUTH_BYPASS_ROUTES = new Set([
  '/api/verify-password',
  '/api/check-auth',
]);

// Routes accessible with password-only (no Microsoft sign-in required)
// These have been hardened to only return DOVA-filtered data
const PASSWORD_ALLOWED_ROUTES = new Set([
  '/api/client/actions',
  '/api/actions',
  '/api/logo',
  '/api/graph-proxy',
]);

function requireSiteAuth(req, res, parsedPath) {
  // OAuth routes (req.query.provider) are always allowed
  if (req.query.provider) return true;
  
  // Auth bypass routes are always allowed
  if (AUTH_BYPASS_ROUTES.has(parsedPath)) return true;

  const cookies = parseCookies(req);

  // Check lu_session (Microsoft OAuth — strongest)
  const session = cookies['lu_session'];
  if (session) {
    try {
      const data = JSON.parse(decodeURIComponent(session));
      if (data.authenticated && data.expires_at && Date.now() < data.expires_at) return true;
    } catch (_) {}
  }

  // Check lu_site_auth (password gate)
  const siteAuth = cookies['lu_site_auth'];
  if (siteAuth) {
    try {
      const data = JSON.parse(decodeURIComponent(siteAuth));
      if (data.authed && data.expires_at && Date.now() < data.expires_at) {
        // Password-only access: only allow routes in PASSWORD_ALLOWED_ROUTES
        if (PASSWORD_ALLOWED_ROUTES.has(parsedPath)) return true;
        // All other routes require Microsoft OAuth
        res.setHeader('Content-Type', 'application/json');
        res.status(401).json({ error: 'Microsoft sign-in required for this route. Visit / to sign in.' });
        return false;
      }
    } catch (_) {}
  }

  // Also check lu_auth (non-HttpOnly Microsoft refresh token cookie)
  const luAuth = cookies['lu_auth'];
  if (luAuth) {
    try {
      const data = JSON.parse(decodeURIComponent(luAuth));
      if (data.refresh_token && data.expires_at && Date.now() < data.expires_at) return true;
    } catch (_) {}
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(401).json({ error: 'Authentication required. Visit / to sign in.' });
  return false;
}
// ── END AUTH GUARD ──

// ── HANDLER: /api/client/actions — client-facing DOVA filter ──
// Only serves rows from the DOVA Action Tracker where Project == "DOVA"
// Fails closed: returns empty array on any error
async function handleClientActions(req, res) {
  try {
    const sheet = await smartsheet.getSheetWithColumns(DOVA_SHEET);
    const projectCol = (sheet.columns || []).find(c => c.title === PROJECT_COL_TITLE);
    if (!projectCol) {
      // Fail closed: no Project column means we cannot verify DOVA status
      return res.json({ sheet: 'actions', rows: [], filtered: true, error: 'Project column not found on sheet' });
    }

    const columns = (sheet.columns || []).map(c => ({
      id: c.id, title: c.title, type: c.type, options: c.options || null, primary: c.primary || false,
    }));

    const rows = (sheet.rows || [])
      .filter(r => {
        const cell = (r.cells || []).find(c => c.columnId === projectCol.id);
        if (!cell) return false;
        const val = (cell.displayValue || cell.value || '').toString().trim();
        return val === PROJECT_COL_VALUE;
      })
      .map(r => {
        const cells = {};
        for (const c of r.cells || []) {
          const col = columns.find(col => col.id === c.columnId);
          if (col) {
            cells[col.title] = c.displayValue ?? (typeof c.value === 'string' ? c.value : null) ?? null;
          }
        }
        return { rowId: r.id, rowNumber: r.rowNumber, cells, createdAt: r.createdAt, modifiedAt: r.modifiedAt };
      });

    return res.json({
      sheet: 'actions',
      sheetId: DOVA_SHEET,
      columns,
      rowCount: rows.length,
      rows,
      filtered: true,
      filter: { column: PROJECT_COL_TITLE, value: PROJECT_COL_VALUE },
    });
  } catch (e) {
    console.error('Client actions error:', e.message);
    // Fail closed
    return res.json({ sheet: 'actions', rows: [], rowCount: 0, filtered: true, error: e.message });
  }
}
// ── END HANDLER: /api/client/actions ──

// ── ROUTER ──

export default async function handler(req, res) {
  const path = parsePath(req.query.path);

  // OAuth routes (called via vercel rewrites /auth/* → /api/oauth?...)
  if (req.query.provider) {
    return oauthHandler(req, res);
  }

  // CORS for all routes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── AUTH GUARD — gate every route except bypass list ──
  if (!requireSiteAuth(req, res, path)) return;
  // ── END AUTH GUARD ──

  try {
    switch (path) {

      // ── EXISTING ROUTES ──
      case '/api/check-auth': return checkAuth(req, res);
      case '/api/verify-password': return verifyPassword(req, res);
      case '/api/chat': return chatHandler(req, res);
      case '/api/prep': return prepHandler(req, res);
      case '/api/stage': return stageHandler(req, res);
      case '/api/promote': return promoteHandler(req, res);
      case '/api/ss-ops': return ssOpsHandler(req, res);
            case '/api/admin/batch': return adminBatch(req, res);
            case '/api/dova': return dovaHandler(req, res);
      case '/api/dova-setup': return dovaSetupHandler(req, res);
      case '/api/dova-seed': return dovaSeedHandler(req, res);
      case '/api/dova-workspace': return dovaWorkspaceHandler(req, res);
            case '/api/dova-update-schedule': return dovaUpdateSchedule(req, res);
                  case '/api/chiefs':
                        case '/api/chiefs/admin': return chiefsHandler(req, res);
            case '/api/chiefs-v3': return chiefsV3Handler(req, res);

            case '/api/sync/flagged-store': {
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
        if (_flaggedCache) setStoredData(_flaggedCache);
        return flaggedHandler(req, res);
      }
      case '/api/outlook/action-items': return actionItems(req, res);
      case '/api/outlook/email': return emailHandler(req, res);
      case '/api/outlook/calendar': return calendarHandler(req, res);
      case '/api/sharepoint/search': return sharepointSearch(req, res);
      case '/api/sharepoint/read': return sharepointRead(req, res);

      // ── SERVING ──
                  case '/api/actions': {
                                // Redirect to main app (standalone widget retired, inline Tasks view active)
                                res.writeHead(302, { Location: '/?view=tasks' });
                                return res.end();
                              }
                  case '/api/client/actions': {
                          return handleClientActions(req, res);
                        }
                  case '/api/logo': {
                                // Serves logo image — assets are statically served by Vercel CDN
                                // Serverless bundle may not include assets/, so redirect to static path
                                res.writeHead(302, { Location: '/assets/level-up-logo.png' });
                                return res.end();
                              }

      // ── NEW PHASE 1 ROUTES ──

      case '/api/state': {
        // GET /api/state?sheet=personal|project|prepmap
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const sheetParam = (url.searchParams.get('sheet') || 'personal').toLowerCase();
        const sheetId = SHEETS[sheetParam];
        if (!sheetId) return res.status(400).json({ error: `Unknown sheet: "${sheetParam}"` });

        return handleState(req, res, sheetId, sheetParam);
      }

      case '/api/admin/create-outbox': {
        // POST /api/admin/create-outbox — one-time, creates the Claude Outbox sheet
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        return handleCreateOutbox(req, res);
      }

      case '/api/admin/ingest-outbox': {
        // GET /api/admin/ingest-outbox — processes pending rows in the Outbox
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
        return handleIngestOutbox(req, res);
      }

      case '/api/admin/cleanup': {
        // POST /api/admin/cleanup — runs Phase 1 cleanup operations
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        return handleCleanup(req, res);
      }

      case '/api/admin/setup-phase2': {
        // POST /api/admin/setup-phase2 — one-time Phase 2 setup
        // Creates Context Requests sheet, adds Visibility column to DOVA tracker
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        try {
          const results = [];

          // 1. Add Visibility column to DOVA Action Tracker
          const DOVA_SHEET = '4456864287772548';
          try {
            const dovaSheet = await smartsheet.getSheetWithColumns(DOVA_SHEET);
            const hasVis = (dovaSheet.columns || []).find(c => c.title === 'Visibility');
            if (!hasVis) {
              await smartsheet.addColumn(DOVA_SHEET, {
                title: 'Visibility',
                type: 'PICKLIST',
                options: ['Internal', 'Owner', 'Both'],
                index: 0,
              });
              results.push({ step: '1-visibility-column', added: true });
            } else {
              results.push({ step: '1-visibility-column', alreadyExists: true });
            }
          } catch (e) {
            results.push({ step: '1-visibility-column', error: e.message });
          }

          // 2. Create Context Requests sheet
          try {
            const home = await smartsheet.getHome();
            const existing = (home.sheets || []).filter(s => s.name === 'Context Requests');
            if (existing.length === 0) {
              const created = await smartsheet.createSheet('Context Requests', [
                { title: 'RequestId', type: 'TEXT_NUMBER', primary: true },
                { title: 'RequestedAt', type: 'DATE' },
                { title: 'RequestType', type: 'PICKLIST', options: ['ConfidenceTriage', 'ThreadHistory', 'SlipPattern', 'PersonHistory', 'CrossProject', 'DocumentRead', 'HasThisComeUpBefore', 'Other'] },
                { title: 'Scope', type: 'TEXT_NUMBER' },
                { title: 'Question', type: 'TEXT_NUMBER' },
                { title: 'Status', type: 'PICKLIST', options: ['Open', 'Answered', 'CannotAnswer'] },
                { title: 'Response', type: 'TEXT_NUMBER' },
                { title: 'AnsweredAt', type: 'DATE' },
              ]);
              results.push({ step: '2-context-requests-sheet', created: true, sheetId: created.result?.id });
            } else {
              results.push({ step: '2-context-requests-sheet', alreadyExists: true, sheetId: existing[0].id });
            }
          } catch (e) {
            results.push({ step: '2-context-requests-sheet', error: e.message });
          }

          return res.json({ success: true, results });
        } catch (e) {
          return res.status(500).json({ error: e.message });
        }
      }
              case '/api/admin/resolve-duplicates': {
              // POST /api/admin/resolve-duplicates — fixes duplicate sheets from name-based creation
              if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
              try {
                const results = [];

                // 1. Canonicalise Prep Map: rename LUCI Prep Map → Prep Map, delete empty
                // Canonical: 1007659559112580 ("LUCI Prep Map", 5 rows)
                // Duplicate: 1625479464570756 ("Prep Map", 0 rows — empty, created by auto-discovery)
                try {
                  await smartsheet.updateSheet('1007659559112580', { name: 'Prep Map' });
                  results.push({ step: '1a-rename-prep-map', id: '1007659559112580', renamed: 'Prep Map' });
                } catch (e) {
                  results.push({ step: '1a-rename-prep-map', error: e.message });
                }
                try {
                  await smartsheet.deleteSheet('1625479464570756');
                  results.push({ step: '1b-delete-empty-prep-map', deleted: '1625479464570756' });
                } catch (e) {
                  results.push({ step: '1b-delete-empty-prep-map', error: e.message });
                }

                // 2. Delete duplicate Outbox sheets
                // Canonical: 107689561771908 (first created, used by all existing code)
                // Duplicates: 7922210758152068, 7082304133615492
                for (const dupId of ['7922210758152068', '7082304133615492']) {
                  try {
                    await smartsheet.deleteSheet(dupId);
                    results.push({ step: '2-delete-outbox-dup', id: dupId, deleted: true });
                  } catch (e) {
                    results.push({ step: '2-delete-outbox-dup', id: dupId, error: e.message });
                  }
                }

                // 3. Delete orphan Personal Action Log
                // 442928536440708 — flagged orphan
                try {
                  await smartsheet.deleteSheet('442928536440708');
                  results.push({ step: '3-delete-orphan-pal', deleted: '442928536440708' });
                } catch (e) {
                  results.push({ step: '3-delete-orphan-pal', error: e.message });
                }

                // 4. Verify no more duplicates
                const home = await smartsheet.getHome();
                const byName = {};
                for (const s of home.sheets || []) {
                  if (!byName[s.name]) byName[s.name] = [];
                  byName[s.name].push(s.id);
                }
                const remainingDupes = Object.entries(byName)
                  .filter(([_, ids]) => ids.length > 1)
                  .map(([name, ids]) => ({ name, ids }));

                return res.json({
                  success: true,
                  results,
                  remainingDuplicates: remainingDupes,
                });
              } catch (e) {
                return res.status(500).json({ error: e.message });
              }
            }

      case '/api/admin/delete-sheet': {
        // POST — delete a sheet by ID
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        try {
          const { sheetId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
          if (!sheetId) return res.status(400).json({ error: 'sheetId required' });
          await smartsheet.deleteSheet(String(sheetId));
          return res.json({ success: true, deleted: sheetId });
        } catch(e) { return res.status(500).json({ error: e.message }); }
      }

      case '/api/admin/add-source-confidence': {
        // POST — Add Source and Confidence columns to DOVA tracker,
        // update Confidence picklist on both sheets, normalize legacy 'staged' values
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        try {
          const results = [];
          const DOVA = '4456864287772548';
          const PERSONAL = '2802755367554948';

          // 1. Add Source column to DOVA (if missing)
          const dovaSheet = await smartsheet.getSheetWithColumns(DOVA);
          if (!(dovaSheet.columns||[]).find(c => c.title === 'Source')) {
            await smartsheet.addColumn(DOVA, {
              title: 'Source', type: 'PICKLIST',
              options: ['Manual', 'Email', 'Granola', 'Notes'],
              index: 0,
            });
            results.push('Added Source column to DOVA');
          } else {
            results.push('Source column already exists on DOVA');
          }

          // 2. Add Confidence column to DOVA (if missing)
          if (!(dovaSheet.columns||[]).find(c => c.title === 'Confidence')) {
            await smartsheet.addColumn(DOVA, {
              title: 'Confidence', type: 'PICKLIST',
              options: ['High', 'Medium', 'Low', 'None'],
              index: 0,
            });
            results.push('Added Confidence column to DOVA');
          } else {
            results.push('Confidence column already exists on DOVA');
          }

          // 3. Update Confidence picklist on Personal log (add Medium and None)
          const persSheet = await smartsheet.getSheetWithColumns(PERSONAL);
          const confCol = (persSheet.columns||[]).find(c => c.title === 'Confidence');
          if (confCol) {
            const currentOps = new Set(confCol.options || []);
            if (!currentOps.has('Medium') || !currentOps.has('None')) {
              const newOps = ['High', 'Medium', 'Low', 'None'];
              // Smartsheet doesn't allow modifying picklist options via API — need to delete and recreate
              // Instead, normalize the existing values and handle via the app layer
              results.push('Confidence picklist needs Medium/None — app-layer handling required');
            } else {
              results.push('Confidence picklist already has Medium/None');
            }
          } else {
            results.push('No Confidence column on Personal log');
          }

          // 4. Update Source picklist on Personal log to add Granola
          const srcCol = (persSheet.columns||[]).find(c => c.title === 'Source');
          if (srcCol) {
            const currentSrc = new Set(srcCol.options || []);
            if (!currentSrc.has('Granola')) {
              results.push('Source picklist needs Granola — app-layer handling required');
            } else {
              results.push('Source picklist already has Granola');
            }
          }

          // 5. Normalize legacy 'staged' Source values on Personal log — deferred to separate run
                    // (normalization loop removed to keep this within 60s Vercel limit)
                    results.push('Normalize staged values: deferred to /api/admin/normalize-sources');

          return res.json({ success: true, results });
        } catch(e) { return res.status(500).json({ error: e.message }); }
      }

      case '/api/admin/normalize-sources': {
        // POST — normalize legacy 'staged' Source values on Personal log to Manual/Granola
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        try {
          const PERSONAL = '2802755367554948';
          const persSheet = await smartsheet.getSheetWithColumns(PERSONAL);
          const srcCol = (persSheet.columns||[]).find(c => c.title === 'Source');
          const srcRefCol = (persSheet.columns||[]).find(c => c.title === 'SourceRef');
          if (!srcCol) return res.json({ success: false, error: 'No Source column on Personal log' });

          const batch = [];
          for (const row of persSheet.rows || []) {
            const srcCell = (row.cells||[]).find(c => c.columnId === srcCol.id);
            if (srcCell && (srcCell.displayValue === 'staged' || String(srcCell.value || '') === 'staged')) {
              const srcRefCell = srcRefCol ? (row.cells||[]).find(c => c.columnId === srcRefCol.id) : null;
              const target = (srcRefCell?.displayValue || '').includes('granola') ? 'Granola' : 'Manual';
              batch.push({ id: row.id, cells: [{ columnId: srcCol.id, value: target }] });
              if (batch.length >= 100) break;
            }
          }
          let result = '0 normalized';
          if (batch.length > 0) {
            await smartsheet.updateRows(PERSONAL, batch);
            result = `Normalized ${batch.length} rows`;
          }
          return res.json({ success: true, normalized: batch.length, result });
        } catch(e) { return res.status(500).json({ error: e.message }); }
      }

      case '/api/admin/update-picklists': {
        // POST — update picklist options on Personal log (Source + Confidence)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        try {
          const PERSONAL = '2802755367554948';
          const persSheet = await smartsheet.getSheetWithColumns(PERSONAL);
          const results = [];

          // Smartsheet API doesn't allow modifying picklist options on existing columns directly.
          // We need to delete and recreate the column. App-layer handling for now.
          const confCol = (persSheet.columns||[]).find(c => c.title === 'Confidence');
          if (confCol && !((confCol.options||[]).includes('Medium'))) {
            // Delete and recreate with new options
            const confIdx = confCol.index;
            await smartsheet.deleteColumn(PERSONAL, confCol.id);
            await smartsheet.addColumn(PERSONAL, {
              title: 'Confidence', type: 'PICKLIST',
              options: ['High', 'Medium', 'Low', 'None'],
              index: confIdx,
            });
            results.push('Recreated Confidence column with Medium/None');
          } else results.push('Confidence already has Medium/None or not found');

          const srcCol = (persSheet.columns||[]).find(c => c.title === 'Source');
          if (srcCol && !((srcCol.options||[]).includes('Granola'))) {
            const srcIdx = srcCol.index;
            await smartsheet.deleteColumn(PERSONAL, srcCol.id);
            await smartsheet.addColumn(PERSONAL, {
              title: 'Source', type: 'PICKLIST',
              options: ['Manual', 'Email', 'Granola', 'Notes'],
              index: srcIdx,
            });
            results.push('Recreated Source column with Granola');
          } else results.push('Source already has Granola or not found');

          return res.json({ success: true, results });
        } catch(e) { return res.status(500).json({ error: e.message }); }
      }

      case '/api/admin/request-blank-project-tri': {
        // POST — create Context Requests row with 199 blank Project rows for LUCI triage
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
        try {
          const DOVA = '4456864287772548';
          const dovaSheet = await smartsheet.getSheetWithColumns(DOVA);
          const aCol = (dovaSheet.columns||[]).find(c => c.title === 'Action ID');
          if (!aCol) return res.json({ error: 'No Action ID column' });
          const blankRows = (dovaSheet.rows||[]).filter(r => {
            const c = (r.cells||[]).find(x => x.columnId === aCol.id);
            const proj = (r.cells||[]).find(x => (dovaSheet.columns||[]).find(c2 => c2.id === x.columnId)?.title === 'Project');
            return !proj || !(proj.displayValue||proj.value||'');
          });
          const scope = blankRows.map(r => {
            const aid = (r.cells||[]).find(x => x.columnId === aCol.id);
            return `${r.id}: ${aid?.displayValue||aid?.value||''}`;
          }).join('\n');

          // Find Context Requests sheet
          const home = await smartsheet.getHome();
          const cr = (home.sheets||[]).filter(s => s.name === 'Context Requests');
          if (cr.length === 0) return res.json({ error: 'Context Requests sheet not found' });
          const crId = cr[0].id;
          const crSheet = await smartsheet.getSheetWithColumns(crId);
          const colMap = {};
          for (const c of crSheet.columns||[]) colMap[c.title] = c.id;

          await smartsheet.addRow(crId, [
            { columnId: colMap['RequestId'], value: `BLANK-PROJECT-${Date.now()}` },
            { columnId: colMap['RequestedAt'], value: new Date().toISOString().split('T')[0] },
            { columnId: colMap['RequestType'], value: 'Other' },
            { columnId: colMap['Scope'], value: scope },
            { columnId: colMap['Question'], value: 'Please classify Project for these 199 rows (rowId: Action ID). Return rowId, Project for each. Anything unsure leave blank.' },
            { columnId: colMap['Status'], value: 'Open' },
          ]);

          return res.json({ success: true, blankRowCount: blankRows.length, scopeSize: scope.length, sheetId: crId });
        } catch(e) { return res.status(500).json({ error: e.message }); }
      }

      case '/api/admin/clean': {
              // POST — comprehensive DOVA tracker cleanup (batch-optimized)
              if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
              try {
                const results = [];
                const DOVA = '4456864287772548';

                function gcv(row, colId) {
                  const cell = (row.cells || []).find(c => c.columnId === colId);
                  if (!cell) return '';
                  const v = cell.displayValue ?? (typeof cell.value === 'object' ? (cell.value.objectValue || '') : cell.value) ?? '';
                  return String(v).trim();
                }

                // Read sheet ONCE
                const sheet = await smartsheet.getSheetWithColumns(DOVA);
                const cols = {}; for (const c of sheet.columns || []) cols[c.title] = c;
                const rows = sheet.rows || [];
                const rowMap = {}; for (const r of rows) rowMap[r.id] = r;

                // 1. Dedupe — batch delete
                const PAIRS = [[5277077752905604,1806590632656772],[681604480106372,2524734934351748],[1878666626334596,5151209441329028],[8871184769351556,2812328897281924],[7874948851433348,2432396358713220],[7026563961454468,5426144256589700],[6227519655772036,6894301517315972],[1980685789822852,4531129980419972],[3136937425239940,2224863538970500],[367135564627844,3469553651285892],[506023801126788,7504026885816196],[6516512704298884,7789282507489156],[217533263773572,7819805766320004],[2283146245177220,6995195399372676],[7061586198527876,6037676732579716],[2262382253965188,547927677730692],[5307550842486660,6034369099071364],[6434363966750596,7012670038867844]];
                const toDel = new Set();
                const deduped = [];
                for (const [idA, idB] of PAIRS) {
                  const a = rowMap[idA], b = rowMap[idB];
                  if (!a || !b) { deduped.push({pair:[idA,idB],note:'already gone'}); continue; }
                  const ca = (a.cells||[]).filter(c=>c.value!==null&&c.value!==undefined&&c.value!=='').length;
                  const cb = (b.cells||[]).filter(c=>c.value!==null&&c.value!==undefined&&c.value!=='').length;
                  const keep = ca>cb ? a : (cb>ca ? b : (a.rowNumber<b.rowNumber?a:b));
                  const del = keep===a ? b : a;
                  toDel.add(del.id);
                  deduped.push({keep:keep.id,delete:del.id});
                }
                results.push({step:'1-dedupe',count:deduped.length,pairs:deduped});

                // 2. Delete: test row, meeting headings, spam, MFP-completed
                const HEADINGS = ['action items','next steps','proposal and next steps','general action item log review','new items added','outreach to trade','granola setup'];
                const aCol = cols['Action ID']; const oCol = cols['Owner']; const cCol = cols['Category']; const pCol = cols['Project'];
                toDel.add('6677603988144004');
                let headingCount = 0, spamCount = 0, mfpCount = 0;
                for (const r of rows) {
                  if (toDel.has(r.id)) continue;
                  const txt = gcv(r, aCol?.id).toLowerCase();
                  const own = gcv(r, oCol?.id).toLowerCase();
                  const cat = gcv(r, cCol?.id).toLowerCase();
                  const proj = gcv(r, pCol?.id).toLowerCase();
                  if (cat === 'spam') { toDel.add(r.id); spamCount++; continue; }
                  if ((own === 'tbd'||own==='') && HEADINGS.some(h=>txt.includes(h))) { toDel.add(r.id); headingCount++; continue; }
                  if (proj === 'mfp' || proj === 'miami freedom park') { toDel.add(r.id); mfpCount++; }
                }
                if (toDel.size > 0) {
            try { await smartsheet.deleteRows(DOVA, [...toDel].map(Number)); }
            catch (e) { /* partial deletion ok — some rows may have been already removed */ }
          }
                results.push({step:'2-delete',total:toDel.size,headings:headingCount,spam:spamCount,mfpCompleted:mfpCount,testRow:1});

                // 3. Backfill Project and fix Status in one batch update
                const aId = cols['Action ID']?.id;
                const pId = cols['Project']?.id;
                const sCol = cols['Status']?.id;
                const batchUpdates = [];
                function rp(t) {
                  const s=t.toLowerCase();
                  if(s.includes('dova')||s.includes('cordova')||s.includes('kozpure')) return 'DOVA';
                  if(s.includes('mfp')||s.includes('miami')||s.includes('boldyn')) return 'MFP';
                  if(s.includes('nhs6')||s.includes('sphere')) return 'Sphere';
                  if(s.includes('business')||s.includes('intro')||s.includes('l&s')) return 'Business';
                  return '';
                }
          
                // Read sheet again after deletions (to get the current state)
                const sheet2 = await smartsheet.getSheetWithColumns(DOVA);
                const rows2 = sheet2.rows || [];
          
                for (const r of rows2) {
                  const cells = [];
                  // Backfill Project if blank
                  const proj = gcv(r, pId);
                  if (!proj && aId) {
                    const text = gcv(r, aId);
                    const res = rp(text);
                    if (res && pId) cells.push({columnId:pId,value:res});
                  }
                  // Fix Status: Archived → Complete
                  const st = gcv(r, sCol);
                  if (st.toLowerCase() === 'archived' && sCol) cells.push({columnId:sCol,value:'Complete'});
                  if (cells.length > 0) batchUpdates.push({id:r.id,cells});
                }
                if (batchUpdates.length > 0) {
            try { await smartsheet.updateRows(DOVA, batchUpdates); }
            catch (e) { /* partial updates ok */ }
          }
                results.push({step:'3-fields',backfill:batchUpdates.filter(u=>u.cells.some(c=>c.columnId===pId)).length,statusFixes:batchUpdates.filter(u=>u.cells.some(c=>c.columnId===sCol)).length,total:batchUpdates.length});

                // 4. Set Visibility on 18 rows
                const visCol = cols['Visibility']?.id;
                if (visCol) {
                  const VIS = ['5437728348438404','1861124652400516','3961561988726660','7070032121692036','3956223781764996','4000881399299972','1735299035561860','6399316496744324','4821298535989124','341158969081732','2183788365479812','4214233204653956','1692338893619076','7012670038867844','2161543132741508','4186307327295364','8036473996181380','5859901816045444'];
                  const visUpdates = VIS.map(rid => ({id:Number(rid), cells:[{columnId:visCol,value:'Both'}]}));
                  await smartsheet.updateRows(DOVA, visUpdates);
                  results.push({step:'4-visibility',count:VIS.length});
                }

                return res.json({success:true,results});
              } catch(e) { return res.status(500).json({error:e.message, stack:e.stack?.substring(0,500)}); }
            }

      case '/api/prep-map': return prepMapHandler(req, res);
                  case '/api/extract-from-note': return extractFromNote(req, res);
                  case '/api/graph-proxy': return graphProxy(req, res);

            // ── V6 SCAN: discover Category stragglers + Status options ──
            case '/api/admin/scan-stragglers': {
              // GET — scans DOVA for old Category values and Status column options
              try {
                const sheet = await smartsheet.getSheetWithColumns('4456864287772548');
                const catCol = (sheet.columns||[]).find(c => c.title === 'Category');
                const statusCol = (sheet.columns||[]).find(c => c.title === 'Status');
                const stragglers = [];
                for (const r of (sheet.rows||[])) {
                  const catCell = (r.cells||[]).find(c => c.columnId === catCol?.id);
                  const cat = (catCell?.displayValue || catCell?.value || '').toString().trim();
                  if (['Design', 'Legal & Insurance', 'Meeting Note'].includes(cat)) {
                    stragglers.push({ rowId: r.id, rowNumber: r.rowNumber, category: cat });
                  }
                }
                return res.json({
                  stragglerCount: stragglers.length,
                  stragglers,
                  statusOptions: statusCol?.options || [],
                  catOptions: catCol?.options || [],
                });
              } catch(e) { return res.status(500).json({ error: e.message }); }
            }

            // ── V6 FIX: update Category stragglers ──
            case '/api/admin/fix-stragglers': {
              // POST — updates "Design"→"Design & Plans", "Legal & Insurance"→"Legal & Contracts", "Meeting Note"→"General Coordination"
              if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
              try {
                const DOVA = '4456864287772548';
                const sheet = await smartsheet.getSheetWithColumns(DOVA);
                const catCol = (sheet.columns||[]).find(c => c.title === 'Category');
                if (!catCol) return res.status(400).json({ error: 'Category column not found' });
                const catId = catCol.id;
                const mapping = {
                  'Design': 'Design & Plans',
                  'Legal & Insurance': 'Legal & Contracts',
                  'Meeting Note': 'General Coordination',
                };
                const batch = [];
                for (const r of (sheet.rows||[])) {
                  const catCell = (r.cells||[]).find(c => c.columnId === catId);
                  const cat = (catCell?.displayValue || catCell?.value || '').toString().trim();
                  if (mapping[cat]) {
                    batch.push({ id: r.id, cells: [{ columnId: catId, value: mapping[cat] }] });
                  }
                }
                let updated = 0;
                if (batch.length > 0) {
                  await smartsheet.updateRows(DOVA, batch);
                  updated = batch.length;
                }
                return res.json({ success: true, updated, details: batch.map(b => ({ rowId: b.id, setTo: b.cells[0].value })) });
              } catch(e) { return res.status(500).json({ error: e.message }); }
            }

      // ── DOVA DASHBOARD (dynamically imported, CJS module) ──
            case '/api/dova-dashboard': {
              const { default: ddHandler } = await import('../lib/handlers/dova-dashboard.js');
              return ddHandler(req, res);
            }

            // ── PASS-THROUGH ROUTES ──
            default:
              if (path === '/api/tasks' || path.startsWith('/api/tasks/')) {
                req.url = '/api/' + req.query.path + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
                return tasksHandler(req, res);
              }
        if (path.startsWith('/api/dispatch/')) {
          req.url = '/api/' + req.query.path + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
          return dispatchHandler(req, res);
        }
        return res.status(404).json({ error: 'Route not found', path, pathStr: String(req.query.path), parsed: parsePath(String(req.query.path)), method: req.method, host: req.headers.host });
    }
  } catch (e) {
    console.error('Index router error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ── HANDLER: /api/state ──

async function handleState(req, res, sheetId, sheetParam) {
  try {
    const sheet = await smartsheet.getSheetWithColumns(sheetId);
    const columns = (sheet.columns || []).map(c => ({
      id: c.id, title: c.title, type: c.type, options: c.options || null, primary: c.primary || false,
    }));
    const rows = (sheet.rows || []).map(r => {
          const cells = {};
          for (const c of r.cells || []) {
            const col = columns.find(col => col.id === c.columnId);
            if (col) {
              if (Array.isArray(c.value) && (col.type === 'MULTI_PICKLIST' || col.type === 'MULTI_CONTACT_LIST' || col.type === 'MULTI_CONTACT_LIST_LINK')) {
                // Multi-value: join relevant fields into comma-separated string
                cells[col.title] = c.value.map(v => typeof v === 'object' ? (v.tag || v.label || v.name || '') : v).filter(Boolean).join(', ') || null;
              } else {
                cells[col.title] = c.displayValue ?? (typeof c.value === 'string' ? c.value : null) ?? null;
              }
            }
          }
          return { rowId: r.id, rowNumber: r.rowNumber, cells, createdAt: r.createdAt, modifiedAt: r.modifiedAt };
    });
    return res.json({ sheet: sheetParam, sheetId, sheetName: sheet.name, columns, rowCount: rows.length, rows });
  } catch (e) {
    console.error('State endpoint error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ── HANDLER: /api/admin/create-outbox ──

async function handleCreateOutbox(req, res) {
  // One-time: find the canonical Outbox sheet or create it once
  const OUTBOX_NAME = 'LUCI - Claude Outbox';
  
  try {
    // First, check canonical ID
    try {
      const existing = await smartsheet.getSheet(OUTBOX_SHEET_ID);
      if (existing.name === OUTBOX_NAME) {
        const sheetData = await smartsheet.getSheetWithColumns(OUTBOX_SHEET_ID);
        return res.json({ success: true, sheetId: OUTBOX_SHEET_ID, columns: sheetData.columns?.map(c => ({ id: c.id, title: c.title, type: c.type })) });
      }
    } catch {}
    // Fallback: search by name — if exactly one, use it
    const home = await smartsheet.getHome();
    const matches = (home.sheets || []).filter(s => s.name === OUTBOX_NAME);
    if (matches.length === 1) {
      const sheetData = await smartsheet.getSheetWithColumns(matches[0].id);
      return res.json({ success: true, sheetId: matches[0].id, columns: sheetData.columns?.map(c => ({ id: c.id, title: c.title, type: c.type })) });
    }
    if (matches.length > 1) {
      return res.json({ error: `Duplicate Outbox sheets: ${matches.map(s=>s.id).join(', ')}. Run resolve-duplicates first.`, duplicateIds: matches.map(s=>s.id) });
    }
    // Create only if no existing sheet with this name
        const OUTBOX_COLUMNS = [
          { title: 'OutboxID', type: 'TEXT_NUMBER', primary: true },
          { title: 'Type', type: 'PICKLIST', options: ['New Action', 'Status Update', 'Summary'] },
          { title: 'TargetSheet', type: 'PICKLIST', options: ['Personal', 'Project'] },
          { title: 'TargetRowId', type: 'TEXT_NUMBER' },
          { title: 'Project', type: 'TEXT_NUMBER' },
          { title: 'ActionText', type: 'TEXT_NUMBER' },
          { title: 'ProposedStatus', type: 'TEXT_NUMBER' },
          { title: 'ProposedUpdate', type: 'TEXT_NUMBER' },
          { title: 'Owner', type: 'TEXT_NUMBER' },
          { title: 'DueDate', type: 'DATE' },
          { title: 'Source', type: 'TEXT_NUMBER' },
          { title: 'SourceRef', type: 'TEXT_NUMBER' },
          { title: 'SourceLink', type: 'TEXT_NUMBER' },
          { title: 'SeriesMasterId', type: 'TEXT_NUMBER' },
          { title: 'Confidence', type: 'PICKLIST', options: ['high', 'medium', 'low'] },
          { title: 'IngestStatus', type: 'PICKLIST', options: ['Pending', 'Ingested', 'Rejected', 'Error'] },
          { title: 'IngestNote', type: 'TEXT_NUMBER' },
          { title: 'IngestedAt', type: 'DATE' },
        ];
        const sheet = await smartsheet.createSheet(OUTBOX_NAME, OUTBOX_COLUMNS);
        return res.json({ success: true, sheetId: sheet.result?.id, columns: sheet.result?.columns?.map(c => ({ id: c.id, title: c.title })) });
      } catch (e) {
        return res.status(500).json({ error: e.message || 'Failed to create Outbox sheet' });
      }
    }

// ── HANDLER: /api/admin/ingest-outbox ──

// Canonical Outbox sheet (resolved by resolve-duplicates)
const OUTBOX_SHEET_ID = '107689561771908';

async function handleIngestOutbox(req, res) {
  const PERSONAL_SHEET = '2802755367554948';
  const PROJECT_SHEET = '4456864287772548';

  try {
    const outbox = await smartsheet.getSheetWithColumns(OUTBOX_SHEET_ID);
    const cols = outbox.columns || [];

    const typeColId = findColId(cols, 'Type');
    const targetSheetColId = findColId(cols, 'TargetSheet');
    const targetRowIdColId = findColId(cols, 'TargetRowId');
    const actionColId = findColId(cols, 'ActionText');
    const statusColId = findColId(cols, 'ProposedStatus');
    const updateColId = findColId(cols, 'ProposedUpdate');
    const ownerColId = findColId(cols, 'Owner');
    const dueColId = findColId(cols, 'DueDate');
    const sourceColId = findColId(cols, 'Source');
    const sourceRefColId = findColId(cols, 'SourceRef');
    const seriesColId = findColId(cols, 'SeriesMasterId');
    const confColId = findColId(cols, 'Confidence');
    const projectColId = findColId(cols, 'Project');
    const ingestStatusColId = findColId(cols, 'IngestStatus');
    const ingestNoteColId = findColId(cols, 'IngestNote');
    const ingestedAtColId = findColId(cols, 'IngestedAt');

    const pending = (outbox.rows || []).filter(r => {
      const s = getCellValue(r, ingestStatusColId);
      return !s || s === 'Pending';
    });

    const results = [];

    for (const row of pending) {
      const rowId = row.id;
      const type = getCellValue(row, typeColId);
      const targetSheet = getCellValue(row, targetSheetColId);
      const targetRowId = getCellValue(row, targetRowIdColId);
      const actionText = getCellValue(row, actionColId);
      const proposedStatus = getCellValue(row, statusColId);
      const proposedUpdate = getCellValue(row, updateColId);
      const owner = getCellValue(row, ownerColId);
      const dueDate = getCellValue(row, dueColId);
      const source = getCellValue(row, sourceColId);
      const sourceRef = getCellValue(row, sourceRefColId);
      const seriesId = getCellValue(row, seriesColId);
      const confidence = getCellValue(row, confColId);
      const project = getCellValue(row, projectColId);

      const targetSheetId = targetSheet === 'Project' ? PROJECT_SHEET : PERSONAL_SHEET;

      try {
        let statusText = 'Error';
        let noteText = '';

        if (type === 'Status Update' && targetRowId) {
          // Update existing row
          const targetData = await smartsheet.getSheetWithColumns(targetSheetId);
          const tCols = targetData.columns || [];
          const statusColIdT = findColId(tCols, 'Status');
          const noteColIdT = findColId(tCols, 'Status Note');
          const cells = [];
          if (statusColIdT && proposedStatus) cells.push({ columnId: statusColIdT, value: proposedStatus });
          if (noteColIdT && proposedUpdate) cells.push({ columnId: noteColIdT, value: proposedUpdate });
          if (cells.length > 0) {
            await guardedWrite({ sheetId: targetSheetId, smartsheet, columns: cells.map(c => ({ columnId: c.columnId, value: String(c.value), title: '' })), existingRowId: targetRowId });
          }
          statusText = 'Ingested';
          noteText = 'Status update applied';
        } else if (type === 'New Action') {
          // Stage via guarded write
          // Get target sheet columns for column ID mapping
          const targetData = await smartsheet.getSheetWithColumns(targetSheetId);
          const tCols = targetData.columns || [];
          const stageCols = [];
          const map = {
            'Action ID': actionText, 'Owner': owner, 'Status': proposedStatus || 'Not Started',
            'Due Date': dueDate, 'Project': project, 'Source': source || 'Manual',
            'SourceRef': sourceRef, 'Confidence': confidence || 'medium', 'SeriesMasterId': seriesId,
          };
          for (const [title, value] of Object.entries(map)) {
            const col = tCols.find(c => c.title === title);
            if (col && value) stageCols.push({ columnId: col.id, value: String(value), title });
          }
          if (stageCols.length > 0) {
            const result = await guardedWrite({ sheetId: targetSheetId, smartsheet, columns: stageCols });
            statusText = result.passed ? 'Ingested' : 'Rejected';
            noteText = result.passed ? 'Staged via guarded write' : (result.reason || 'Guard rejected');
          } else {
            statusText = 'Rejected';
            noteText = 'No valid columns to write';
          }
        } else {
          statusText = 'Rejected';
          noteText = `Unknown type: ${type}`;
        }

        const updateCells = [{ columnId: ingestStatusColId, value: statusText }];
        if (noteText) updateCells.push({ columnId: ingestNoteColId, value: noteText.substring(0, 200) });
        updateCells.push({ columnId: ingestedAtColId, value: new Date().toISOString().split('T')[0] });
        await smartsheet.updateRow(OUTBOX_SHEET_ID, rowId, updateCells);
                results.push({ rowId, type, status: statusText, note: noteText });
              } catch (e) {
                try {
                  await smartsheet.updateRow(OUTBOX_SHEET_ID, rowId, [
            { columnId: ingestStatusColId, value: 'Error' },
            { columnId: ingestNoteColId, value: e.message.substring(0, 200) },
          ]);
        } catch (e2) {}
        results.push({ rowId, type, status: 'Error', error: e.message });
      }
    }

    return res.json({ success: true, processed: results.length, results });
  } catch (e) {
    console.error('Ingest outbox error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ── HANDLER: /api/admin/cleanup ──

async function handleCleanup(req, res) {
  const DOVA_SHEET = '4456864287772548';
  const MFP_SHEET = '5109402316263300';
  const PERSONAL_SHEET = '2802755367554948';
  const results = [];

  try {
    // 1. MOVE: read MFP rows from DOVA Project, add to MFP sheet, then delete from DOVA
    const dovaSheet = await smartsheet.getSheetWithColumns(DOVA_SHEET);
    const projectCol = dovaSheet.columns.find(c => c.title === 'Project');
    const mfpRows = (dovaSheet.rows || []).filter(r => {
      const val = (getCellValue(r, projectCol?.id) || '').toLowerCase();
      return val === 'mfp' || val === 'miami freedom park';
    });

    if (mfpRows.length > 0) {
      // Get MFP sheet columns for field mapping
      const mfpSheet = await smartsheet.getSheetWithColumns(MFP_SHEET);
      const mfpCols = mfpSheet.columns || [];

      // Build and add rows to MFP sheet
      const addRows = mfpRows.map(r => {
        const cells = [];
        for (const c of r.cells || []) {
          const srcCol = dovaSheet.columns.find(col => col.id === c.columnId);
          if (!srcCol) continue;
          const dstCol = mfpCols.find(col => col.title === srcCol.title);
          if (!dstCol) continue;
          cells.push({ columnId: dstCol.id, value: c.value ?? '' });
        }
        return { cells, toBottom: true };
      });
      if (addRows.length > 0) {
        await smartsheet.addRows(MFP_SHEET, addRows);
      }

      // Delete from DOVA
      await smartsheet.deleteRows(DOVA_SHEET, mfpRows.map(r => r.id));
      results.push({ step: '1-mfp-rows', moved: mfpRows.length, deleted: mfpRows.length });
    } else {
      results.push({ step: '1-mfp-rows', moved: 0 });
    }

    // 2. Delete test rows
    const testPatterns = ['build fix test', 'luna test push', 'luci test push', '^1$'];
    const actionColD = dovaSheet.columns.find(c => c.title === 'Action ID');
    const testRowsDova = (dovaSheet.rows || []).filter(r => {
      const val = (getCellValue(r, actionColD?.id) || '').toLowerCase().trim();
      return testPatterns.some(p => new RegExp(p, 'i').test(val));
    });
    const personalSheet = await smartsheet.getSheetWithColumns(PERSONAL_SHEET);
    const actionColP = personalSheet.columns.find(c => c.title === 'Action ID');
    const testRowsPersonal = (personalSheet.rows || []).filter(r => {
      const val = (getCellValue(r, actionColP?.id) || '').toLowerCase().trim();
      return testPatterns.some(p => new RegExp(p, 'i').test(val));
    });
    if (testRowsDova.length > 0) await smartsheet.deleteRows(DOVA_SHEET, testRowsDova.map(r => r.id));
    if (testRowsPersonal.length > 0) await smartsheet.deleteRows(PERSONAL_SHEET, testRowsPersonal.map(r => r.id));
    results.push({ step: '2-test-rows', deleted: testRowsDova.length + testRowsPersonal.length });

    // 3. Delete duplicate email rows (keep first, delete rest)
    const dupKeywords = ['gamba', 'didomenico'];
    const dupRows = (personalSheet.rows || []).filter(r => {
      const val = (getCellValue(r, actionColP?.id) || '').toLowerCase();
      return dupKeywords.some(k => val.includes(k));
    });
    if (dupRows.length > 1) {
      const toDelete = dupRows.slice(1).map(r => r.id);
      await smartsheet.deleteRows(PERSONAL_SHEET, toDelete);
      results.push({ step: '3-dup-emails', deleted: toDelete.length, kept: dupRows[0]?.id });
    } else {
      results.push({ step: '3-dup-emails', count: dupRows.length, note: 'One or fewer, no action' });
    }

    return res.json({ success: true, results });
  } catch (e) {
    console.error('Cleanup error:', e.message);
    return res.status(500).json({ error: e.message, results });
  }
}

// ── UTILITY ──

function parsePath(path) {
  const p = Array.isArray(path) ? path[0] : path;
  return '/api/' + (p || '').replace(/\/$/, '');
}

export const config = { maxDuration: 60 };