#!/usr/bin/env python3
"""MFP cron sync — pushes cached flagged-local.json to Playbook API.
Designed for Session 0 (cron/SCHTASKS) where Outlook COM is unavailable.
Uses only stdlib (no requests module needed)."""
import json, os, sys, ssl
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

PLAYBOOK_URL = "https://level-up-playbook.vercel.app/api/sync/flagged-store"
SYNC_KEY = "59085493e8e63a164be0e443575b99f191b5c7fdb791c539"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(BASE_DIR, "flagged-local.json")
LOG_FILE = os.path.join(BASE_DIR, "flagged-sync.log")

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except:
        pass

def main():
    log("=" * 60)
    log("MFP Cron Sync starting")

    if not os.path.exists(CACHE_FILE):
        log(f"ERROR: Cache file not found at {CACHE_FILE}")
        return {"status": "error", "detail": "cache not found"}

    with open(CACHE_FILE) as f:
        payload = json.load(f)

    actions = payload.get("actions", [])
    cache_modified = datetime.fromtimestamp(os.path.getmtime(CACHE_FILE))
    log(f"Cache: flagged-local.json (modified {cache_modified}), {len(actions)} actions")

    if not actions:
        log("Nothing to sync")
        return {"status": "ok", "count": 0}

    payload["_scanned_at"] = datetime.now().isoformat()
    payload["_count"] = len(actions)
    payload["source"] = "mfp_cron_fallback"

    log(f"Posting {len(actions)} actions to Playbook API...")

    body = json.dumps(payload).encode("utf-8")
    req = Request(
        PLAYBOOK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-sync-key": SYNC_KEY,
        },
        method="POST"
    )

    ctx = ssl.create_default_context()
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED

    try:
        with urlopen(req, timeout=30, context=ctx) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            log(f"CRON FALLBACK: Pushed cached local backup ({len(actions)} actions) to Playbook API")
            log(f"Playbook API response: status={result.get('status','?')}, count={result.get('count',0)}, stored_at={result.get('stored_at','?')}")
            log(f"Result: {len(actions)} actions synced to Playbook")
            return {"status": "ok", "count": len(actions), "api": result}
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:200]
        log(f"Sync FAILED: HTTP {e.code} - {err_body}")
        return {"status": "error", "code": e.code, "detail": err_body}
    except URLError as e:
        log(f"Sync FAILED: URL error - {e.reason}")
        return {"status": "error", "detail": str(e.reason)}
    except Exception as e:
        log(f"Sync ERROR: {e}")
        return {"status": "error", "detail": str(e)}

if __name__ == "__main__":
    result = main()
    print("\nRESULT_JSON:", json.dumps(result))
