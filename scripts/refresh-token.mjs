import fs from 'fs';
const data = JSON.parse(fs.readFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', 'utf-8'));

const TID = '8222d14d-0869-42d3-8b7f-858c65b89c0e';
const CID = 'f79b29d9-4f75-47db-ad18-9f99406872da';

async function main() {
  // Use the original token's full scope
  const scope = data.scope || 'openid profile email offline_access User.Read Calendars.Read CallTranscripts.Read.All Files.Read.All Files.ReadWrite.All Mail.Read Mail.ReadWrite Mail.Send OnlineMeetings.Read OnlineMeetingTranscript.Read.All Sites.Read.All Sites.ReadWrite.All';
  
  console.log('Using scope:', scope);
  
  const r = await fetch('https://login.microsoftonline.com/' + TID + '/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CID,
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
      scope: scope,
    })
  });
  const result = await r.json();
  if (!r.ok) {
    console.error('Refresh failed:', JSON.stringify(result));
    process.exit(1);
  }
  console.log('Token refreshed! Valid for', result.expires_in, 'seconds');
  console.log('New token:', result.access_token.substring(0, 50) + '...');
  fs.writeFileSync('C:/Users/HermesAdmin/.hermes/msal_tokens.json', JSON.stringify(result, null, 2));
  console.log('Token saved');
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });