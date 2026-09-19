#!/usr/bin/env python3
"""MFP Graph Auth via Device Code Flow.
Step 1: Get device code and display it. User visits URL and enters code.
Step 2 (--poll): After user authenticates, acquire the token."""
import msal, json, sys

CLIENT_ID = "de8bc8b5-d9f9-48b1-a8ad-b748da725064"
TENANT = "a17d169a-e877-4f01-8b06-748096cf7f19"
SCOPES = ["Mail.Read", "Mail.ReadWrite", "User.Read"]
TOKEN_FILE = r'C:\Users\HermesAdmin\.hermes\mfp_graph_token.json'
FLOW_FILE = r'C:\Users\HermesAdmin\.hermes\mfp_device_flow.json'

app = msal.PublicClientApplication(CLIENT_ID, authority="https://login.microsoftonline.com/" + TENANT)

# Step 2: Poll for token after user authenticates
if '--poll' in sys.argv:
    with open(FLOW_FILE) as f:
        flow = json.load(f)
    result = app.acquire_token_by_device_flow(flow)
    if "access_token" in result:
        print("AUTH SUCCESS")
        with open(TOKEN_FILE, 'w') as f:
            json.dump(result, f)
        print("Token saved to " + TOKEN_FILE)
        # Test
        import urllib.request
        hdr = {'Authorization': 'Bearer ' + result['access_token']}
        req = urllib.request.Request('https://graph.microsoft.com/v1.0/me/messages?$top=3&$select=subject,receivedDateTime&$orderby=receivedDateTime desc', headers=hdr)
        resp = json.loads(urllib.request.urlopen(req).read())
        for m in resp.get('value', []):
            print(f"  [{m.get('receivedDateTime','')[:10]}] {m.get('subject','?')}")
    else:
        print("FAIL: " + result.get('error', 'unknown'))
        print(result.get('error_description', ''))
    sys.exit(0)

# Step 1: Get device code
print("Initializing device code flow...", flush=True)
flow = app.initiate_device_flow(scopes=SCOPES)
if "user_code" not in flow:
    print("Failed: " + str(flow.get("error", "unknown")))
    sys.exit(1)

# Save flow for step 2
with open(FLOW_FILE, 'w') as f:
    json.dump(flow, f)

print()
print("=== MFP GRAPH AUTH ===")
print()
print("1. Visit: " + flow['verification_uri'])
print("2. Enter code: " + flow['user_code'])
print("3. Sign in with your MFP account")
print()
print("After authenticating, run: --poll")
print("Code expires in " + str(flow.get('expires_in', 900) // 60) + " minutes")