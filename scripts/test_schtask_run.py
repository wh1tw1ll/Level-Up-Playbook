import json, sys, os
from datetime import datetime, timezone

log_file = r'C:\Users\HermesAdmin\.hermes\mfp_mail_scan_log.json'
entry = {
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'status': 'test_run_by_schtask',
    'staged': 0,
    'skipped': 0,
    'folders_scanned': 0,
    'message': 'Test script ran successfully from schtasks',
    'python_version': sys.version,
    'cwd': os.getcwd(),
    'user': os.environ.get('USERNAME', 'unknown')
}
try:
    with open(log_file) as f:
        log = json.load(f)
except:
    log = []
log.append(entry)
with open(log_file, 'w') as f:
    json.dump(log, f, indent=2)
print('SUCCESS: Test script ran', flush=True)