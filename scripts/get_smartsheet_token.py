#!/usr/bin/env python3
"""Get SMARTSHEET_TOKEN from Vercel project env vars using OIDC token."""
import requests, json, os, re

env_file = r'C:\Users\HermesAdmin\Level-Up-Playbook\.env'
oidc_token = None
with open(env_file) as f:
    for line in f:
        if line.startswith('VERCEL_OIDC_TOKEN='):
            val = line.split('=', 1)[1].strip().strip('"').strip("'")
            oidc_token = val
            break

if not oidc_token:
    print('VERCEL_OIDC_TOKEN not found in .env')
    exit(1)

print('OIDC token found ({} chars)'.format(len(oidc_token)))

project_id = 'prj_ZKr4S56J2xJr41cpyRAKdaULnxsX'
team_id = None  # not specified in deploy script

# Try to get env vars
headers = {
    'Authorization': 'Bearer {}'.format(oidc_token),
    'Content-Type': 'application/json'
}

# First list all env vars
url = 'https://api.vercel.com/v9/projects/{}/env'.format(project_id)
if team_id:
    url += '?teamId={}'.format(team_id)

r = requests.get(url, headers=headers)
print('Status:', r.status_code)
if r.status_code == 200:
    data = r.json()
    envs = data.get('envs', [])
    for env in envs:
        key = env.get('key', '')
        val = env.get('value', '')
        target = env.get('target', [])
        if key == 'SMARTSHEET_TOKEN':
            print('SMARTSHEET_TOKEN: {}'.format(val))
            print('Target:', target)
    print('Total env vars:', len(envs))
else:
    print('Response:', r.text[:500])