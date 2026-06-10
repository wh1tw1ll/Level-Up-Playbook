// api/procore/data.js — Fetch financial data from Procore API
// Called on page load by the Playbook and on schedule by the cron job.
// Uses refresh token to get a fresh access token each time.

async function getAccessToken() {
  const refreshToken = process.env.PROCORE_REFRESH_TOKEN;
  const CLIENT_ID = process.env.PROCORE_CLIENT_ID;
  const CLIENT_SECRET = process.env.PROCORE_CLIENT_SECRET;

  if (!refreshToken || !CLIENT_ID || !CLIENT_SECRET) {
    return null;
  }

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

async function fetchFromProcore(url, token) {
  const companyId = process.env.PROCORE_COMPANY_ID;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  if (companyId) headers['Procore-Company-Id'] = companyId;

  const r = await fetch(url, { headers });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Procore API ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

// Map Procore commitment data to our existing financial format
function toOurFormat(commitments, token) {
  const subs = commitments.map(c => ({
    company: c.vendor?.name || c.company || 'Unknown',
    title: c.description || c.title || '',
    orig: c.original_amount || 0,
    co: (c.approved_change_orders || 0),
    revised: (c.original_amount || 0) + (c.approved_change_orders || 0),
    paid: (c.paid_amount || 0) + (c.invoiced_amount || 0),
    balance: ((c.original_amount || 0) + (c.approved_change_orders || 0)) - ((c.paid_amount || 0) + (c.invoiced_amount || 0)),
    pct_paid: ((c.original_amount || 0) > 0 ? (((c.paid_amount || 0) + (c.invoiced_amount || 0)) / ((c.original_amount || 0) + (c.approved_change_orders || 0)) * 100) : 0)
  }));

  const totalOriginal = subs.reduce((s, c) => s + c.orig, 0);
  const totalApprovedCOs = subs.reduce((s, c) => s + c.co, 0);
  const totalRevised = subs.reduce((s, c) => s + c.revised, 0);
  const totalPaid = subs.reduce((s, c) => s + c.paid, 0);
  const totalBalance = subs.reduce((s, c) => s + c.balance, 0);
  const totalPctPaid = totalRevised > 0 ? (totalPaid / totalRevised) * 100 : 0;

  return {
    hard: {
      commitments: subs,
      total_original: totalOriginal,
      total_approved_cos: totalApprovedCOs,
      total_revised: totalRevised,
      total_invoiced: totalPaid,
      total_paid: totalPaid,
      total_balance: totalBalance,
      total_pct_paid: totalPctPaid,
      sync_timestamp: new Date().toISOString()
    },
    summary: {
      total_budget: totalRevised,
      paid_to_date: totalPaid,
      incurred_to_date: totalPaid,
      past_due: 0,
      retainage_held: totalRevised - totalPaid,
      stadium_base_contract: totalOriginal,
      stadium_pct_complete: totalPctPaid,
      hard_cost_total: totalRevised,
      approved_cos_total: totalApprovedCOs,
      days_past_baseline: 153,
      target_completion: 'July 31, 2026'
    }
  };
}

export default async function handler(req, res) {
  const PROJECT_ID = process.env.PROCORE_PROJECT_ID || '2916773';

  const token = await getAccessToken();
  if (!token) {
    return res.status(401).json({
      error: 'Procore not connected',
      needs_auth: true,
      auth_url: '/procore/login'
    });
  }

  try {
    // Fetch commitments (subcontracts) — this gives us the financial data
    const commitments = await fetchFromProcore(
      `https://api.procore.com/v1.0/projects/${PROJECT_ID}/commitments?per_page=100`,
      token
    );

    const formatted = toOurFormat(commitments, token);

    // Cache for 1 hour on CDN (Vercel respects this)
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(formatted);

  } catch (err) {
    console.error('Procore sync error:', err.message);
    res.status(500).json({
      error: err.message,
      sync_timestamp: new Date().toISOString()
    });
  }
}