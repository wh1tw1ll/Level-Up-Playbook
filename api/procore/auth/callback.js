// api/procore/auth/callback.js — Handle Procore OAuth callback
export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error) return res.redirect('/?procore_error=' + encodeURIComponent(error));
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const CLIENT_ID = process.env.PROCORE_CLIENT_ID;
  const CLIENT_SECRET = process.env.PROCORE_CLIENT_SECRET;
  const REDIRECT = process.env.PROCORE_REDIRECT_URI || 'https://level-up-playbook.vercel.app/procore/callback';

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'Procore credentials not configured' });
  }

  try {
    const tokenRes = await fetch('https://login.procore.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenRes.json();

    if (tokens.error || !tokens.access_token) {
      console.error('Procore token exchange failed:', tokens);
      return res.redirect('/?procore_error=' + encodeURIComponent((tokens.error_description || tokens.error || 'Token exchange failed').substring(0, 300)));
    }

    // Also discover company IDs this token has access to
    let companyId = null;
    try {
      const coRes = await fetch('https://api.procore.com/v1.0/companies', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      if (coRes.ok) {
        const companies = await coRes.json();
        if (companies && companies.length > 0) {
          companyId = companies[0].id;
        }
      }
    } catch(e) {
      console.error('Company discovery failed:', e.message);
    }

    // Show success page with refresh token and company info
    const refreshToken = tokens.refresh_token || 'N/A';
    const companyInfo = companyId ? `Company ID: ${companyId}` : 'Company discovery failed — you may need to set PROCORE_COMPANY_ID manually';

    res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Procore Connected</title>
<style>
body{font-family:system-ui,sans-serif;background:#0e1419;color:#e8ecef;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.card{background:#1a232b;border:1px solid #2a3540;border-radius:14px;padding:32px;max-width:560px;width:100%}
h1{color:#8BED1C;font-size:20px;margin:0 0 8px}
p{color:#8a98a5;font-size:14px;line-height:1.6;margin:0 0 20px}
.label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#8a98a5;margin-bottom:4px}
.value{background:#0e1419;border:1px solid #2a3540;border-radius:8px;padding:12px;font-family:monospace;font-size:13px;word-break:break-all;margin-bottom:16px;color:#8BED1C}
.ok{color:#8BED1C;font-size:14px;font-weight:600;margin-top:16px}
</style>
</head>
<body>
<div class="card">
<h1>✅ Procore Connected</h1>
<p>Your Procore account has been authorized. Copy the refresh token below and send it to LUNA to complete the setup.</p>
<div class="label">Refresh Token</div>
<div class="value" id="refresh-token">${refreshToken}</div>
<div class="label">${companyInfo}</div>
<div class="ok">✓ Token received. Copy it and paste it back to LUNA in your chat.</div>
</div>
<script>
// Auto-copy to clipboard for convenience
var token = document.getElementById('refresh-token');
if (token && token.textContent !== 'N/A') {
  navigator.clipboard.writeText(token.textContent).catch(function(){});
}
</script>
</body>
</html>`);

  } catch(err) {
    console.error('Procore callback error:', err);
    res.redirect('/?procore_error=server_error');
  }
}