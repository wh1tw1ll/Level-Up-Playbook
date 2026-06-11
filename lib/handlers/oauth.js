// lib/handlers/oauth.js — OAuth handler for Microsoft Sign-In and Procore
import { parseCookies } from '../auth.js';

const SHARED_STYLES = `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      background: #0e1419;
      color: #e8edf2;
      font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1a232b;
      border: 1px solid #2a3540;
      border-radius: 12px;
      padding: 48px 40px 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .lockup { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 36px; }
    .lockup-mark {
      width: 36px; height: 36px; background: #8BED1C; border-radius: 7px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .lockup-text { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
    .lockup-name { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #e8edf2; line-height: 1; }
    .lockup-sub { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #8BED1C; line-height: 1; }
    .spinner {
      width: 40px; height: 40px; border: 3px solid #2a3540; border-top-color: #8BED1C;
      border-radius: 50%; margin: 0 auto 24px; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 18px; font-weight: 600; color: #e8edf2; margin-bottom: 8px; letter-spacing: -0.01em; }
    p { font-size: 13px; color: #6b8299; line-height: 1.5; }
    .dot-pulse { display: inline-flex; gap: 4px; margin-top: 16px; }
    .dot-pulse span {
      width: 5px; height: 5px; background: #8BED1C; border-radius: 50%;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
    .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%,80%,100% { opacity: 0.2; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
    .error-icon { font-size: 32px; margin-bottom: 16px; }
    .error-detail { margin-top: 16px; padding: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; font-size: 12px; color: #f87171; word-break: break-all; }
  </style>
`;

const LOCKUP_HTML = `
  <div class="lockup">
    <div class="lockup-mark">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 3L19 7V15L11 19L3 15V7L11 3Z" fill="#0e1419"/>
        <path d="M11 3L11 19M3 7L19 15M19 7L3 15" stroke="#0e1419" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="lockup-text">
      <span class="lockup-name">Level Up</span>
      <span class="lockup-sub">L.U.N.A. Intelligence</span>
    </div>
  </div>
`;

function htmlPage(title, bodyContent) {
  return `<!DOCTYPE html><html lang="en"><head>${SHARED_STYLES}<title>${title}</title></head><body><div class="card">${LOCKUP_HTML}${bodyContent}</div></body></html>`;
}

function successPage(redirectTo) {
  const r = redirectTo || '/?auth=success';
  return htmlPage('Signing In - L.U.N.A.',
    `<div class="spinner"></div><h1>Signing you in</h1><p>Verifying your credentials and loading your workspace.</p>
     <div class="dot-pulse"><span></span><span></span><span></span></div>
     <script>setTimeout(function(){window.location.replace("${r}");},600)</script>`
  );
}

function errorPage(message, detail, redirectTo) {
  const r = redirectTo || '/?auth=error';
  return htmlPage('Sign In Error - L.U.N.A.',
    `<div class="error-icon">\u26A0</div><h1>Sign in failed</h1><p>${message || 'Something went wrong.'}</p>
     ${detail ? `<div class="error-detail">${detail}</div>` : ''}
     <div class="dot-pulse" style="margin-top:24px"><span></span><span></span><span></span></div>
     <script>setTimeout(function(){window.location.replace("${r}");},4000)</script>`
  );
}

function procoreSuccessPage(at, rt) {
  return htmlPage('Procore Connected - L.U.N.A.',
    `<h1 style="color:#8BED1C">\u2713 Procore Connected</h1><p>Store these tokens securely. The refresh token does not expire.</p>
     <div style="margin-top:24px;text-align:left;background:#0e1419;border:1px solid #2a3540;border-radius:8px;padding:14px 16px">
     <div style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6b8299;margin-bottom:6px">Access Token</div>
     <div style="font-family:monospace;font-size:11px;color:#8BED1C;word-break:break-all;line-height:1.5">${at}</div></div>
     ${rt ? `<div style="margin-top:10px;text-align:left;background:#0e1419;border:1px solid #2a3540;border-radius:8px;padding:14px 16px">
       <div style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6b8299;margin-bottom:6px">Refresh Token (save this)</div>
       <div style="font-family:monospace;font-size:11px;color:#8BED1C;word-break:break-all;line-height:1.5">${rt}</div></div>` : ''}`
  );
}

// ─── Microsoft handlers
function msLoginHandler(req, res) {
  const CID = process.env.LU_CLIENT_ID;
  const TID = process.env.LU_TENANT_ID;
  const REDIR = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';
  if (!CID || !TID) return res.status(500).json({ error: 'Auth not configured' });
  const scopes = 'openid profile email offline_access User.Read Calendars.Read Calendars.Read.Shared Mail.Read.Shared Tasks.Read';
  const url = `https://login.microsoftonline.com/${TID}/oauth2/v2.0/authorize?client_id=${CID}&response_type=code&redirect_uri=${encodeURIComponent(REDIR)}&scope=${encodeURIComponent(scopes)}&response_mode=query&state=lu`;
  return res.redirect(302, url);
}

function msMfpLoginHandler(req, res) {
  const CID = process.env.LU_CLIENT_ID;
  const TID = process.env.LU_MFP_TENANT_ID || 'a17d169a-e877-4f01-8b06-748096cf7f19';
  const REDIR = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';
  if (!CID) return res.status(500).json({ error: 'MFP auth not configured' });
  const scopes = 'openid profile email offline_access User.Read Calendars.Read Mail.Read';
  const url = `https://login.microsoftonline.com/${TID}/oauth2/v2.0/authorize?client_id=${CID}&response_type=code&redirect_uri=${encodeURIComponent(REDIR)}&scope=${encodeURIComponent(scopes)}&response_mode=query&state=mfp`;
  return res.redirect(302, url);
}

async function msCallbackHandler(req, res) {
  const { code, error, error_description, state } = req.query;
  if (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(errorPage('Microsoft returned an error', `${error}: ${error_description || ''}`));
  }
  if (!code) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(errorPage('No authorization code received'));
  }

  const isMfp = state === 'mfp';
  const TID = isMfp ? (process.env.LU_MFP_TENANT_ID || 'a17d169a-e877-4f01-8b06-748096cf7f19') : process.env.LU_TENANT_ID;
  const cookieName = isMfp ? 'lu_auth_mfp' : 'lu_auth';

  try {
    const CID = process.env.LU_CLIENT_ID;
    const CS = process.env.LU_CLIENT_SECRET;
    const REDIR = process.env.LU_REDIRECT_URI || 'https://level-up-playbook.vercel.app/auth/callback';
    const scopes = isMfp
      ? 'openid profile email offline_access User.Read Calendars.Read Mail.Read'
      : 'openid profile email offline_access User.Read Calendars.Read Calendars.Read.Shared Mail.Read.Shared Tasks.Read';

    const tokenRes = await fetch(`https://login.microsoftonline.com/${TID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CID, client_secret: CS, grant_type: 'authorization_code', code, redirect_uri: REDIR, scope: scopes })
    });
    const tokens = await tokenRes.json();
    if (tokens.error) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(errorPage('Token exchange failed', `${tokens.error}: ${tokens.error_description || ''}`));
    }

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const me = await meRes.json();
    const name = me.displayName || me.userPrincipalName || 'User';
    const email = me.mail || me.userPrincipalName || '';

    const authPayload = encodeURIComponent(JSON.stringify({
      refresh_token: tokens.refresh_token || '',
      name, email, tenant_id: TID,
      expires_at: Date.now() + 7 * 24 * 3600 * 1000
    }));
    const sessionPayload = encodeURIComponent(JSON.stringify({
      name, email, authenticated: true,
      expires_at: Date.now() + 7 * 24 * 3600 * 1000
    }));

    res.setHeader('Set-Cookie', [
      `${cookieName}=${authPayload}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
    ]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const html = htmlPage('Signing In - L.U.N.A.',
      `<div class="spinner"></div><h1>Welcome, ${name.replace(/[<>&"]/g, '')}</h1><p>Signing you into L.U.N.A.</p>
       <div class="dot-pulse"><span></span><span></span><span></span></div>
       <script>document.cookie="lu_session=${sessionPayload}; Path=/; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}";setTimeout(function(){window.location.replace("/?auth=success");},500)</script>`
    );
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(errorPage('Unexpected error', err.message));
  }
}

function msMeHandler(req, res) {
  const cookies = parseCookies(req);
  const session = cookies['lu_session'];
  if (session) {
    try {
      const data = JSON.parse(decodeURIComponent(session));
      if (data.authenticated && data.name) return res.json({ authenticated: true, name: data.name, email: data.email });
    } catch (e) { /* ignore */ }
  }
  const enc = cookies['lu_auth'];
  if (enc) {
    try {
      const data = JSON.parse(decodeURIComponent(enc));
      if (data.refresh_token && data.name) return res.json({ authenticated: true, name: data.name, email: data.email });
    } catch (e) { /* ignore */ }
  }
  return res.status(401).json({ authenticated: false, reason: 'not_authenticated' });
}

function msLogoutHandler(req, res) {
  res.setHeader('Set-Cookie', [
    'lu_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'lu_session=; Path=/; Secure; SameSite=Lax; Max-Age=0'
  ]);
  return res.redirect(302, '/');
}

// ─── Procore handlers
function procoreLoginHandler(req, res) {
  const CID = process.env.PROCORE_CLIENT_ID;
  const REDIR = process.env.PROCORE_REDIRECT_URI || 'https://level-up-playbook.vercel.app/procore/callback';
  if (!CID) return res.status(500).json({ error: 'PROCORE_CLIENT_ID not configured' });
  return res.redirect(302, `https://login.procore.com/oauth/authorize?client_id=${CID}&redirect_uri=${encodeURIComponent(REDIR)}&response_type=code`);
}

async function procoreCallbackHandler(req, res) {
  const { code, error } = req.query;
  if (error || !code) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(errorPage('Procore did not return an authorization code', error || ''));
  }
  try {
    const CID = process.env.PROCORE_CLIENT_ID;
    const CS = process.env.PROCORE_CLIENT_SECRET;
    const REDIR = process.env.PROCORE_REDIRECT_URI || 'https://level-up-playbook.vercel.app/procore/callback';
    const tokenRes = await fetch('https://login.procore.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', client_id: CID, client_secret: CS, redirect_uri: REDIR, code })
    });
    const tokens = await tokenRes.json();
    if (tokens.error || !tokens.access_token) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(errorPage('Procore token exchange failed', tokens.error_description || tokens.error || JSON.stringify(tokens)));
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(procoreSuccessPage(tokens.access_token, tokens.refresh_token));
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(errorPage('Unexpected Procore error', err.message));
  }
}

async function procoreDiscoverHandler(req, res) {
  const refreshToken = req.query.rt || process.env.PROCORE_REFRESH_TOKEN;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token', auth_url: '/procore/login' });

  try {
    const r = await fetch('https://login.procore.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', client_id: process.env.PROCORE_CLIENT_ID, client_secret: process.env.PROCORE_CLIENT_SECRET, refresh_token: refreshToken })
    });
    const tokens = await r.json();
    if (tokens.error || !tokens.access_token) return res.status(401).json({ error: 'Token refresh failed', new_rt: tokens.refresh_token || '' });

    const at = tokens.access_token;
    const result = { new_rt: tokens.refresh_token || '' };

    // Discover companies
    try {
      const coRes = await fetch('https://api.procore.com/rest/v1.0/companies', { headers: { Authorization: `Bearer ${at}` } });
      if (coRes.ok) result.companies = await coRes.json();
      else result.companies_error = `HTTP ${coRes.status}`;
    } catch (e) { result.companies_error = e.message; }

    // Discover projects
    if (result.companies?.length > 0) {
      result.projects = {};
      for (const c of result.companies.slice(0, 3)) {
        try {
          const pRes = await fetch('https://api.procore.com/rest/v1.0/projects', {
            headers: { Authorization: `Bearer ${at}`, 'Procore-Company-Id': String(c.id) }
          });
          if (pRes.ok) {
            result.projects[c.id] = (await pRes.json()).map(p => ({ id: p.id, name: p.name, number: p.project_number || '' }));
          }
        } catch (e) { result.projects[`${c.id}_error`] = e.message; }
      }
    } else if (!result.companies_error) {
      try {
        const pRes = await fetch('https://api.procore.com/rest/v1.0/projects', { headers: { Authorization: `Bearer ${at}` } });
        if (pRes.ok) result.projects_no_company = (await pRes.json()).map(p => ({ id: p.id, name: p.name, number: p.project_number || '' }));
      } catch (e) { result.projects_error = e.message; }
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function procoreDataHandler(req, res) {
  const refreshToken = req.query.rt || process.env.PROCORE_REFRESH_TOKEN;
  if (!refreshToken) return res.status(401).json({ error: 'Procore not connected', needs_auth: true, auth_url: '/procore/login' });

  try {
    const r = await fetch('https://login.procore.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', client_id: process.env.PROCORE_CLIENT_ID, client_secret: process.env.PROCORE_CLIENT_SECRET, refresh_token: refreshToken })
    });
    const tokens = await r.json();
    if (tokens.error || !tokens.access_token) return res.status(401).json({ error: 'Token refresh failed', new_rt: tokens.refresh_token || '', needs_auth: true, auth_url: '/procore/login' });

    const projectId = process.env.PROCORE_PROJECT_ID || '2916773';
    const headers = { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' };
    if (process.env.PROCORE_COMPANY_ID) headers['Procore-Company-Id'] = process.env.PROCORE_COMPANY_ID;

    const resp = await fetch(`https://api.procore.com/rest/v1.0/commitments?project_id=${projectId}&per_page=100`, { headers });
    if (!resp.ok) {
      let errBody = '';
      try { errBody = await resp.text(); } catch (e) {}
      return res.status(502).json({
        error: `Procore API ${resp.status}`, detail: errBody.substring(0, 500),
        new_rt: tokens.refresh_token || '', project_id: projectId, company_id: process.env.PROCORE_COMPANY_ID
      });
    }
    const subs = await resp.json();
    const trimmed = subs.map(c => ({
      company: c.vendor?.name || c.company || 'Unknown',
      title: c.description || c.title || '',
      orig: c.original_amount || 0, co: c.approved_change_orders || 0,
      revised: (c.original_amount || 0) + (c.approved_change_orders || 0),
      paid: (c.invoiced_amount || 0) + (c.paid_amount || 0),
      balance: ((c.original_amount || 0) + (c.approved_change_orders || 0)) - ((c.invoiced_amount || 0) + (c.paid_amount || 0)),
      pct_paid: ((c.original_amount || 0) + (c.approved_change_orders || 0)) > 0
        ? (((c.invoiced_amount || 0) + (c.paid_amount || 0)) / ((c.original_amount || 0) + (c.approved_change_orders || 0)) * 100) : 0
    }));
    const totals = trimmed.reduce((a, s) => {
      a.orig += s.orig; a.co += s.co; a.revised += s.revised; a.paid += s.paid; a.balance += s.balance;
      return a;
    }, { orig: 0, co: 0, revised: 0, paid: 0, balance: 0 });

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({
      new_rt: tokens.refresh_token || '',
      hard: {
        commitments: trimmed,
        total_original: totals.orig, total_approved_cos: totals.co,
        total_revised: totals.revised, total_paid: totals.paid,
        total_balance: totals.balance,
        total_pct_paid: totals.revised > 0 ? (totals.paid / totals.revised * 100) : 0,
        sync_timestamp: new Date().toISOString()
      },
      summary: {
        total_budget: totals.revised, paid_to_date: totals.paid,
        incurred_to_date: totals.paid, past_due: 0,
        retainage_held: totals.revised - totals.paid,
        stadium_base_contract: totals.orig,
        stadium_pct_complete: totals.revised > 0 ? (totals.paid / totals.revised * 100) : 0,
        hard_cost_total: totals.revised, approved_cos_total: totals.co,
        days_past_baseline: 153, target_completion: 'July 31, 2026'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Main router
export default async function handler(req, res) {
  const provider = req.query.provider;
  const action = req.query.action;

  // Microsoft auth routes
  if (provider === 'microsoft' || !provider) {
    if (action === 'login') {
      if (req.query.tenant === 'mfp') return msMfpLoginHandler(req, res);
      return msLoginHandler(req, res);
    }
    if (action === 'callback') return await msCallbackHandler(req, res);
    if (action === 'me') return msMeHandler(req, res);
    if (action === 'logout') return msLogoutHandler(req, res);
  }

  // Procore routes
  if (provider === 'procore') {
    if (action === 'login') return procoreLoginHandler(req, res);
    if (action === 'callback') return await procoreCallbackHandler(req, res);
    if (action === 'data') return await procoreDataHandler(req, res);
    if (action === 'discover') return await procoreDiscoverHandler(req, res);
  }

  return res.status(404).json({ error: 'Unknown oauth route' });
}