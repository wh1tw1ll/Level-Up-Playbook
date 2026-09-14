import json, subprocess, os, sys

token = json.load(open('C:/Users/HermesAdmin/.vercel/auth.json'))['token']
vercel_js = 'C:/Windows/system32/config/systemprofile/AppData/Roaming/npm/node_modules/vercel/dist/vc.js'
os.chdir('C:/Users/HermesAdmin/Level-Up-Playbook')

result = subprocess.run(
    ['node', vercel_js, 'deploy', '--prod', '--token', token],
    capture_output=True, text=True, timeout=120
)
out = result.stdout.strip()
if out:
    print(out)
if result.stderr:
    print('ERR:', result.stderr.strip()[-200:], file=sys.stderr)
print('EXIT:', result.returncode)