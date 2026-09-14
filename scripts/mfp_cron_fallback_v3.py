#!/usr/bin/env python3
"""MFP Cron Fallback v3 — push cached flagged-local.json items as a batch to the Playbook API."""
import json, os, sys, requests
from datetime import datetime

PLAYBOOK_URL = "https://level-up-playbook.vercel.app/api/sync/flagged-store"
SYNC_KEY = "59085493e8e63a164be0e443575b99f191b5c7fdb791c539"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(SCRIPT_DIR, "flagged-local.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "flagged-sync.log")

if not os.path.exists(CACHE_PATH):
    print("[SILENT]")
    sys.exit(0)

ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

with open(CACHE_PATH, "r") as f:
    data = json.load(f)

actions = data if isinstance(data, list) else data.get("actions", data.get("items", []))

# Filter out already-synced items (no status or status == "open")
pending = [a for a in actions if a.get("status") in (None, "", "open")]

if not pending:
    print(f"[{ts}] No pending actions to sync (0 of {len(actions)} pending)")
    sys.exit(0)

# Build payload matching the API expectation
payload = {
    "source": "MFP (Flagged)",
    "actions": pending
}

try:
    resp = requests.post(
        PLAYBOOK_URL,
        json=payload,
        headers={"x-sync-key": SYNC_KEY},
        timeout=15
    )
    if resp.status_code == 200:
        result = resp.json()
        count = result.get("count", len(pending))
        print(f"[{ts}] OK: {count} actions synced to Playbook")
    else:
        print(f"[{ts}] ERROR {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print(f"[{ts}] Exception: {e}")

# Log to file
try:
    with open(LOG_FILE, "a") as f:
        f.write(f"[{ts}] MFP Cron Fallback v3: {len(pending)} pending of {len(actions)} total\n")
        f.write(f"[{ts}] Result: {len(pending)} actions synced to Playbook\n")
except:
    pass