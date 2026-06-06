export default function handler(req, res) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  raw.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim().slice(0, 50) + '...';
  });
  return res.json({
    hasLuAuth: !!cookies['lu_auth'],
    cookieKeys: Object.keys(cookies),
    cookiePreview: cookies,
    timestamp: new Date().toISOString()
  });
}
