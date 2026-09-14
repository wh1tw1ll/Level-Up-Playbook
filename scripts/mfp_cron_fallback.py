#!/usr/bin/env python3
"""MFP Cron Fallback v2 — push cached flagged-local.json items one-by-one to match main script's API pattern."""
import json, os, sys, requests
from datetime import datetime

PLAYBOOK_URL = "https://level-up-playbook.vercel.app/api/sync/flagged-store"
SYNC_KEY = "59085493e8e63a164be0e443575b99f191b5c7fdb791c539"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(SCRIPT_DIR, "flagged-local.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "flagged-sync.log")

cache_file = CACHE_PATH if os.path.exists(CACHE_PATH) else None
if not cache_file:
    import glob
    matches = glob.glob(os.path.join(os.path.dirname(SCRIPT_DIR), "**", "flagged-local.json"), recursive=True)
    if matches:
        cache_file = matches[0]

if not cache_file:
    print("[SILENT]")
    sys.exit(0)

ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

with open(cache_file, "r") as f:
    data = json.load(f)

actions = data if isinstance(data, list) else data.get("actions", data.get("items", []))

# Post individual items like the main script does
synced = 0
skipped = 0
errors = 0

for item in actions:
    # Map cached fields to what the main script sends
    entry_id = item.get("entry_id", item.get("id", ""))
    subject = item.get("subject", "")
    sender = item.get("sender", item.get("from", ""))
    received = item.get("received", item.get("received_time", ""))
    action_type = item.get("action_type", "informational")
    summary = item.get("summary", subject)
    deadline = item.get("deadline", None)
    confidence = item.get("confidence", item.get("urgency", "low"))

    payload = {
        "entry_id": entry_id,
        "subject": subject,
        "sender": sender,
        "received": received,
        "action_type": action_type,
        "summary": summary,
        "deadline": deadline or None,
        "confidence": "high" if action_type in ("action_required","for_approval","decision_needed") else ("medium" if action_type in ("for_review","follow_up") else "low")
    }

    try:
        resp = requests.post(
            PLAYBOOK_URL,
            json=payload,
            headers={"x-sync-key": SYNC_KEY},
            timeout=15
        )
        if resp.status_code == 200:
            synced += 1
        elif resp.status_code == 409:
            skipped += 1
        else:
            print(f"[{ts}] ERROR {resp.status_code} for '{subject[:60]}': {resp.text[:120]}")
            errors += 1
    except Exception as e:
        print(f"[{ts}] Exception for '{subject[:60]}': {e}")
        errors += 1

print(f"[{ts}] ============================================================")
print(f"[{ts}] MFP Cron Sync complete: {synced} synced, {skipped} skipped (already synced), {errors} errors")
print(f"[{ts}] Result: {synced} actions synced to Playbook")

# Log to file
try:
    with open(LOG_FILE, "a") as f:
        f.write(f"[{ts}] ============================================================\n")
        f.write(f"[{ts}] MFP Cron Sync starting (individual POST fallback)\n")
        f.write(f"[{ts}] Cache: {cache_file} ({len(actions)} actions)\n")
        f.write(f"[{ts}] Posting {len(actions)} actions individually...\n")
        f.write(f"[{ts}] CRON FALLBACK: {synced} synced, {skipped} skipped, {errors} errors\n")
        f.write(f"[{ts}] Result: {synced} actions synced to Playbook\n")
except:
    pass