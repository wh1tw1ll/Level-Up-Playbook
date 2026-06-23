#!/usr/bin/env python3
"""
MFP Cron Fallback — pushes cached flagged emails to Playbook API.
For use when Outlook COM is unavailable (Session 0 cron job context).
"""
import json, os, requests
from datetime import datetime

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flagged-local.json")
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flagged-sync.log")
TRACKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".mfp_cron_tracker")
PLAYBOOK_URL = "https://level-up-playbook.vercel.app/api/sync/flagged-store"
SYNC_KEY = "59085493e8e63a164be0e443575b99f191b5c7fdb791c539"


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def main():
    # Check tracker
    today = datetime.now().strftime("%Y-%m-%d")
    already_ran = False
    if os.path.exists(TRACKER):
        with open(TRACKER) as f:
            if f.read().strip() == today:
                already_ran = True

    if not os.path.exists(CACHE):
        log("No local cache found. Nothing to sync.")
        print("RESULT: 0 actions (no cache)")
        return

    with open(CACHE) as f:
        cached = json.load(f)

    actions = cached.get("actions", [])
    cache_mtime = os.path.getmtime(CACHE)
    cache_date = datetime.fromtimestamp(cache_mtime).strftime("%Y-%m-%d %H:%M:%S")

    log("=" * 60)
    log("MFP cron fallback starting")
    log(f"Cache: flagged-local.json (created {cache_date}), {len(actions)} actions")

    if already_ran:
        log(f"Fallback already ran today ({len(actions)} actions). Suppressing.")
        print(f"RESULT: Suppressed (already ran today, {len(actions)} cached actions)")
        return

    log(f"Posting {len(actions)} actions to Playbook API...")
    try:
        payload = {
            "actions": actions,
            "source": "mfp_com_local",
            "_count": len(actions),
            "_scanned_at": datetime.now().isoformat()
        }
        resp = requests.post(
            PLAYBOOK_URL,
            json=payload,
            headers={"Content-Type": "application/json", "x-sync-key": SYNC_KEY},
            timeout=30
        )
        if resp.ok:
            result = resp.json()
            log(f"CRON FALLBACK: Pushed cached local backup ({len(actions)} actions) to Playbook API")
            log(f"Playbook API response: status={result.get('status','?')}, count={result.get('count','?')}, stored_at={result.get('stored_at','?')}")
            log(f"Result: {len(actions)} actions synced to Playbook")
            with open(TRACKER, "w") as f:
                f.write(today)
            print(f"RESULT: {len(actions)} actions synced from cache to Playbook")
        else:
            log(f"Sync FAILED: HTTP {resp.status_code} - {resp.text[:200]}")
            print(f"RESULT: FAILED - HTTP {resp.status_code}")
    except Exception as e:
        log(f"Sync ERROR: {e}")
        print(f"RESULT: ERROR - {e}")

    log("=" * 60)


if __name__ == "__main__":
    main()