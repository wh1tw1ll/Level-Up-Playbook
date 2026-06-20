#!/usr/bin/env python3
r"""mfp-cron-fallback.py — Deterministic cron fallback for MFP flagged email sync.

Call from cron/session 0 every 15-30 minutes. This script handles the full
decision logic:
  1. Checks today's fallback marker (flagged-fallback-marker.txt) for dedup
  2. Falls back to log scan of last 1000 lines if marker is missing
  3. If a fallback already ran today -> writes marker (for next cycle speed)
     -> exits silently (suppresses delivery)
  4. Otherwise -> reads flagged-local.json and POSTs to Playbook API
  5. Writes marker file on success to prevent re-POSTs
  6. Logs the result to flagged-sync.log

The marker file avoids the window-size fragility of pure log scanning —
a single-line state file is accurate across reboots, log rotations, and
arbitrarily long gaps between cron cycles.

Usage:
  python C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp-cron-fallback.py

Requires: requests (available in Hermes venv + standalone Python 3.14)
"""
import hashlib, json, os, re, sys
from datetime import datetime, date

# -- Hardcoded paths (Windows-native -- Python doesn't understand /c/ paths) --
SCRIPT_DIR = r"C:\Users\HermesAdmin\Level-Up-Playbook\scripts"
LOG_FILE = os.path.join(SCRIPT_DIR, "flagged-sync.log")
BACKUP_PATH = os.path.join(SCRIPT_DIR, "flagged-local.json")
MARKER_PATH = os.path.join(SCRIPT_DIR, "flagged-fallback-marker.txt")
PLAYBOOK_URL = "https://level-up-playbook.vercel.app/api/sync/flagged-store"
SYNC_KEY = "59085493e8e63a164be0e443575b99f191b5c7fdb791c539"


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def load_backup():
    """Return (actions_list, cache_mtime_str) or (None, None) if missing."""
    if not os.path.exists(BACKUP_PATH):
        return None, None
    mtime = os.path.getmtime(BACKUP_PATH)
    mtime_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
    with open(BACKUP_PATH) as f:
        data = json.load(f)
    actions = data.get("actions", [])
    return actions, mtime_str


def check_todays_fallback():
    """Check if a fallback already ran today. Returns count or 0.
    
    Uses a persistent marker file (fast, accurate, survives log rotation).
    Falls back to log scan (last 1000 lines) if marker is missing or stale.
    """
    today = date.today()
    today_str = today.strftime("%Y-%m-%d")

    # Primary: marker file (one read, no log parsing)
    if os.path.exists(MARKER_PATH):
        try:
            with open(MARKER_PATH) as f:
                marker_date, marker_count = f.read().strip().split("|")
            if marker_date == today_str:
                return int(marker_count)
        except (ValueError, OSError):
            pass  # Corrupt or unreadable -- fall through to log scan

    # Fallback: log scan (last 1000 lines covers ~24h at current log rates)
    patterns = [
        r"fallback.*pushed.*cached.*local.*backup.*?\((\d+).*actions.*playbook",
        r"MFP Sync Fallback: Posted.*?(\d+).*actions.*from local backup",
    ]

    if not os.path.exists(LOG_FILE):
        return 0

    try:
        with open(LOG_FILE) as f:
            lines = f.readlines()
    except OSError:
        return 0

    for line in lines[-1000:]:
        if today_str not in line:
            continue
        for pat in patterns:
            m = re.search(pat, line, re.IGNORECASE)
            if m:
                return int(m.group(1))
    return 0


def write_marker(count):
    """Write today's fallback marker file."""
    today_str = date.today().strftime("%Y-%m-%d")
    try:
        with open(MARKER_PATH, "w") as f:
            f.write(f"{today_str}|{count}")
    except OSError:
        pass


def hash_actions(actions):
    """Return a stable hash of the actions list for dedup at the API."""
    raw = json.dumps(actions, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def post_to_api(actions):
    """POST to Playbook API. Returns dict or None on failure."""
    try:
        import requests as req
    except ImportError:
        log("ERROR: requests module not available -- can't POST to API")
        return None

    payload = {
        "actions": actions,
        "source": "mfp_cron_fallback",
        "_count": len(actions),
        "_hash": hash_actions(actions),
        "_scanned_at": datetime.now().isoformat(),
    }

    try:
        resp = req.post(
            PLAYBOOK_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "x-sync-key": SYNC_KEY,
            },
            timeout=30,
        )
        if resp.ok:
            return resp.json()
        else:
            log(f"API ERROR: HTTP {resp.status_code} -- {resp.text[:200]}")
            return None
    except req.exceptions.Timeout:
        log("API TIMEOUT after 30s")
        return None
    except Exception as e:
        log(f"API REQUEST FAILED: {e}")
        return None


def main():
    log("=" * 60)
    log("MFP cron fallback starting")

    # Step 1: Check if a fallback already ran today
    already_pushed = check_todays_fallback()
    if already_pushed > 0:
        # Write marker on early-exit too, so subsequent cycles use fast marker-read
        # instead of re-scanning 1000 log lines every time.
        write_marker(already_pushed)
        log(f"Fallback already ran today ({already_pushed} actions). Suppressing.")
        print("[SILENT]")
        sys.exit(0)

    # Step 2: Load cached backup
    actions, cache_mtime = load_backup()
    if actions is None:
        log("ERROR: No flagged-local.json cache found")
        log("=" * 60)
        return

    log(f"Cache: flagged-local.json (created {cache_mtime}), {len(actions)} actions")

    if len(actions) == 0:
        log("Cache is empty -- nothing to push")
        log("=" * 60)
        return

    # Step 3: POST to API
    log(f"Posting {len(actions)} actions to Playbook API...")
    result = post_to_api(actions)

    if result is None:
        log("FALLBACK FAILED -- API did not accept data")
        log("=" * 60)
        return

    count = result.get("count", len(actions))
    stored_at = result.get("stored_at", "unknown")
    write_marker(count)
    log(f"CRON FALLBACK: Pushed cached local backup ({count} actions) to Playbook API")
    log(f"Playbook API response: status=ok, count={count}, stored_at={stored_at}")
    log(f"Result: {count} actions synced to Playbook")
    log("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FATAL ERROR in mfp-cron-fallback.py: {e}")
        raise
