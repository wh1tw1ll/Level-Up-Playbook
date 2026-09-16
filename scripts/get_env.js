const fs = require('fs');
const https = require('https');

const auth = JSON.parse(fs.readFileSync('C:\\Users\\HermesAdmin\\.vercel\\auth.json', 'utf8'));
const token = auth.token;

function vercel(path) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.vercel.com' + path;
    https.get(url, { headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  const data = await vercel('/v9/projects/prj_ZKr4S56J2xJr41cpyRAKdaULnxsX/env?teamId=team_kOveNb85LcKfom6pKWzqXysj');
  console.log('Total env vars:', (data.envs || []).length);
  (data.envs || []).forEach(e => {
    if (e.key.includes('SMART') || e.key.includes('SITE_PASSWORD') || e.key.includes('LU_')) {
      console.log(e.key + '=' + e.value);
    }
  });
}

main().catch(e => console.log('Error:', e.message));