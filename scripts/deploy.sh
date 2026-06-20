#!/bin/bash
cd /c/Users/HermesAdmin/Level-Up-Playbook
source .env.vercel
TOKEN="$VERCEL_OIDC_TOKEN"
echo "Using token: ${TOKEN:0:20}..."
curl -sv -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"level-up-playbook","project":"prj_ZKr4S56J2xJr41cpyRAKdaULnxsX","target":"production","withLatest":true}' 2>&1 | head -50