// api/procore/[...slug].js — combined handler for /procore/login, /procore/callback, /procore/data
// Single file to stay under Vercel Hobby's 12-function limit.

async function getAccessToken() {
  const refreshToken = process.env.PROCORE_REFRESH_TOKEN;
  const CLIENT_ID = process.env.PROCORE_CLIENT_ID;
  const CLIENT_SECRET = process.env.PROCORE_CLIENT_SECRET;
  if (!refreshToken || !CLIENT_ID || !CLIENT_SECRET) return null;
  const r = await fetch('https://login.procore.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const tokens = await r.json();
  if (tokens.error || !tokens.access_token) {
    console.error('Procore token refresh failed:', tokens.error);
    return null;
  }
  return tokens.access_token;
}

async function handleLogin(req, res) {
  const CLIENT_ID = process.env.PROCORE_CLIENT_ID;
  const REDIRECT = process.env.PROCORE_REDIRECT_URI || 'https://level-up-playbook.vercel.app/procore/callback';
  if (!CLIENT_ID) return res.status(500).json({ error: 'PROCORE_CLIENT_ID not configured' });
  res.redirect(302, `https://login.procore.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code`);
}

async function handleCallback(req, res) {
  const { code, error } = req.query;
  if (error) return res.redirect('/?procore_error=' + encodeURIComponent(error));
  if (!code) return res.status(400).json({ error: 'No code' });

  const CLIENT_ID = process.env.PROCORE_CLIENT_ID;
  const CS = process.env.PROCORE_CLIENT_SECRET;
  const REDIRECT = process.env.PROCORE_REDIRECT_URI || 'https://level-up-playbook.vercel.app/procore/callback';
  if (!CLIENT_ID || !CS) return res.status(500).json({ error: 'Procore credentials not configured' });

  try {
    const tokenRes = await fetch('https://login.procore.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CS, code, redirect_uri: REDIRECT, grant_type: 'authorization_code' })
    });
    const tokens = await tokenRes.json();
    if (tokens.error || !tokens.access_token) {
      console.error('Procore token exchange failed:', tokens);
      return res.redirect('/?procore_error=' + encodeURIComponent((tokens.error_description || tokens.error || 'Exchange failed').substring(0, 300)));
    }

    let companyId = null;
    try {
      const coRes = await fetch('https://api.procore.com/v1.0/companies', { headers: { Authorization: 'Bearer ' + tokens.access_token } });
      if (coRes.ok) {
        const companies = await coRes.json();
        if (companies && companies.length > 0) companyId = companies[0].id;
      }
    } catch(e) { console.error('Company discovery failed:', e.message); }

    const rt = tokens.refresh_token || 'N/A';
    res.status(200).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Procore Connected</title><style>body{font-family:system-ui,sans-serif;background:#0e1419;color:#e8ecef;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{background:#1a232b;border:1px solid #2a3540;border-radius:14px;padding:32px;max-width:560px;width:100%}h1{color:#8BED1C;font-size:20px;margin:0 0 8px}p{color:#8a98a5;font-size:14px;line-height:1.6;margin:0 0 20px}.label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#8a98a5;margin-bottom:4px}.val{background:#0e1419;border:1px solid #2a3540;border-radius:8px;padding:12px;font-family:monospace;font-size:13px;word-break:break-all;margin-bottom:16px;color:#8BED1C}.ok{color:#8BED1C;font-size:14px;font-weight:600;margin-top:16px}</style></head><body><div class="card"><h1>Procore Connected</h1><p>Authorized. Copy the <strong>Refresh Token</strong> below and send to LUNA.</p><div class="label">Refresh Token</div><div class="val" id="rt">' + rt + '</div>' + (companyId ? '<div class="label">Company ID <span style="color:#8a98a5;font-weight:400">(auto-detected)</span></div><div class="val">' + companyId + '</div>' : '') + '<div class="ok">Paste the refresh token back to LUNA in your chat.</div></div><script>var t=document.getElementById("rt");if(t&&t.textContent!=="N/A")navigator.clipboard.writeText(t.textContent).catch(function(){})</script></body></html>');
  } catch(err) {
    console.error('Procore callback error:', err);
    res.redirect('/?procore_error=server_error');
  }
}

async function handleData(req, res) {
  const token = await getAccessToken();
  if (!token) {
    return res.status(401).json({ error: 'Procore not connected', needs_auth: true, auth_url: '/procore/login' });
  }

  const companyId = process.env.PROCORE_COMPANY_ID;
  const projectId = process.env.PROCORE_PROJECT_ID || '2916773';
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  if (companyId) headers['Procore-Company-Id'] = companyId;

  try {
    const resp = await fetch('https://api.procore.com/v1.0/projects/' + projectId + '/commitments?per_page=100', { headers });
    if (!resp.ok) throw new Error('Procore API ' + resp.status);
    const subs = (await resp.json()).map(function(c) {
      return {
        company: c.vendor ? c.vendor.name : (c.company || 'Unknown'),
        title: c.description || c.title || '',
        orig: c.original_amount || 0,
        co: (c.approved_change_orders || 0),
        revised: (c.original_amount || 0) + (c.approved_change_orders || 0),
        paid: (c.invoiced_amount || 0) + (c.paid_amount || 0),
        balance: ((c.original_amount || 0) + (c.approved_change_orders || 0)) - ((c.invoiced_amount || 0) + (c.paid_amount || 0)),
        pct_paid: (c.original_amount || 0) > 0 ? (((c.invoiced_amount || 0) + (c.paid_amount || 0)) / ((c.original_amount || 0) + (c.approved_change_orders || 0)) * 100) : 0
      };
    });

    var totalOriginal = 0, totalCOs = 0, totalRevised = 0, totalPaid = 0, totalBalance = 0;
    subs.forEach(function(s) {
      totalOriginal += s.orig;
      totalCOs += s.co;
      totalRevised += s.revised;
      totalPaid += s.paid;
      totalBalance += s.balance;
    });
    var totalPct = totalRevised > 0 ? (totalPaid / totalRevised) * 100 : 0;

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      hard: {
        commitments: subs, total_original: totalOriginal, total_approved_cos: totalCOs,
        total_revised: totalRevised, total_invoiced: totalPaid, total_paid: totalPaid,
        total_balance: totalBalance, total_pct_paid: totalPct, sync_timestamp: new Date().toISOString()
      },
      summary: {
        total_budget: totalRevised, paid_to_date: totalPaid, incurred_to_date: totalPaid,
        past_due: 0, retainage_held: totalRevised - totalPaid,
        stadium_base_contract: totalOriginal, stadium_pct_complete: totalPct,
        hard_cost_total: totalRevised, approved_cos_total: totalCOs,
        days_past_baseline: 153, target_completion: 'July 31, 2026'
      }
    });
  } catch(err) {
    console.error('Procore data error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  var slug = (req.query.slug || []).join('/');
  if (slug === 'login' || slug === '') return handleLogin(req, res);
  if (slug === 'callback') return handleCallback(req, res);
  if (slug === 'data') return handleData(req, res);
  res.status(404).json({ error: 'Unknown endpoint: ' + slug });
}