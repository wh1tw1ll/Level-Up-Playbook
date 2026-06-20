#!/usr/bin/env python3
"""
MFP Flagged Email Sync — reads flagged MFP emails via Outlook COM,
analyzes body content for action/context, pushes to Playbook.
DESIGN: This script is designed to run from the interactive Windows session
(Session 1, e.g. via the Windows Startup folder VBS script sync_mfp_flagged.vbs).
It will NOT work from a Session 0 cron/scheduled task because Outlook COM
requires an interactive user profile.
"""

import json, os, sys, re, requests, win32com.client, pythoncom, threading
from datetime import datetime, timedelta, timezone

# ── Config ──────────────────────────────────────────────────────────
PLAYBOOK_URL = "https://level-up-playbook.vercel.app/api/sync/flagged-store"
SYNC_KEY = "59085493e8e63a164be0e443575b99f191b5c7fdb791c539"
LOOKBACK_DAYS = 60
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts", "flagged-sync.log")

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except:
        pass


def extract_action(subject, body, sender, received):
    """Analyze email subject+body, return structured action item."""
    text = (subject or "") + " " + (body or "")[:3000]
    text_lower = text.lower()

    # Detect deadline patterns
    deadline = None
    deadline_patterns = [
        r'due\s+(?:by|on|date)?\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'deadline[\s:]+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'by\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)',
        r'response\s+(?:by|required|needed)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)',
    ]
    for pat in deadline_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            deadline = m.group(1).strip()
            break

    urgency_keywords = {
        'action_required': ['action required', 'urgent', 'immediately', 'asap', 'critical', 'time-sensitive'],
        'for_approval': ['approval', 'approve', 'approved', 'sign off', 'for your signature'],
        'for_review': ['review', 'please review', 'for your review', 'feedback needed', 'comments'],
        'decision_needed': ['decision', 'decide', 'please advise', 'your input needed', 'what should we'],
        'follow_up': ['follow up', 'check in', 'touching base', 'next steps', 'update', 'status', 'progress'],
        'informational': ['inform', 'notice', 'announcement', 'update', 'notification'],
    }

    action_type = 'informational'
    for atype, kws in urgency_keywords.items():
        if any(kw in text_lower for kw in kws):
            action_type = atype
            break

    summary = (subject or "(no subject)").strip()
    if len(summary) < 10 and body:
        first_line = body.strip().split('\n')[0][:100]
        if first_line:
            summary = first_line

    confidence = "low"
    if action_type in ('action_required', 'for_approval', 'decision_needed'):
        confidence = "high"
    elif action_type in ('for_review', 'follow_up'):
        confidence = "medium"

    return {
        "action_type": action_type,
        "summary": summary,
        "deadline": deadline,
        "confidence": confidence,
        "sender": sender or "unknown",
        "received": received or ""
    }


def sync():
    log("=" * 60)
    log("MFP Flagged Email Sync starting")

    pythoncom.CoInitialize()

    # Connect to Outlook — try Dispatch first (works in Session 0 headless),
    # fallback to GetActiveObject (works when there's a visible window)
    outlook_app = None
    try:
        outlook_app = win32com.client.Dispatch("Outlook.Application")
        log("Outlook connected via Dispatch")
    except Exception as e1:
        try:
            outlook_app = win32com.client.GetActiveObject("Outlook.Application")
            log("Outlook connected via GetActiveObject")
        except Exception as e2:
            log(f"ERROR: Cannot connect to Outlook. Dispatch: {e1}. GetActiveObject: {e2}")
            log("HINT: Outlook COM automation only works from an interactive Windows session")
            log("HINT: where the user is logged in and a mail profile is configured.")
            log(f"HINT: Current session: {os.environ.get('SESSIONNAME', '?')}, PID: {os.getpid()}")
            return

    # Get MAPI namespace
    try:
        outlook = outlook_app.GetNamespace("MAPI")
        log("MAPI namespace obtained")
    except Exception as e:
        log(f"ERROR: GetNamespace('MAPI') failed: {e}")
        log("HINT: Outlook may be running without a configured mail profile.")
        return

    # Find MFP store
    store_mfp = None
    for s in outlook.Stores:
        if "Whitney.Williams@miamifreedompark.com" in s.DisplayName and "Archive" not in s.DisplayName:
            store_mfp = s
            break

    if not store_mfp:
        log("ERROR: MFP store not found (Whitney.Williams@miamifreedompark.com)")
        log("Available stores:")
        for s in outlook.Stores:
            log(f"  - {s.DisplayName}")
        return

    root = store_mfp.GetRootFolder()
    inbox = None
    for f in root.Folders:
        if f.Name == "Inbox":
            inbox = f
            break

    if not inbox:
        log("ERROR: MFP Inbox not found")
        return

    log(f"MFP store: {store_mfp.DisplayName}")
    log(f"Total inbox items: {inbox.Items.Count}")

    # Use Restrict filter to get only flagged items — avoids full inbox scan
    items = inbox.Items
    items.Sort("[ReceivedTime]", True)

    cutoff = datetime.now(timezone.utc).astimezone() - timedelta(days=LOOKBACK_DAYS)
    filter_str = f"[ReceivedTime] >= '{cutoff.strftime('%m/%d/%Y %I:%M %p')}' AND [FlagStatus] = 2"

    flagged_items = None
    try:
        flagged_items = items.Restrict(filter_str)
        log(f"Filtered flagged items (Restrict): {flagged_items.Count}")
    except Exception as e:
        log(f"WARNING: Restrict filter failed ({e}), falling back to full iteration")
        flagged_items = items

    # Process each flagged email
    synced = []
    errors = 0
    processed = 0

    for mail in flagged_items:
        try:
            # If we couldn't use Restrict, filter manually
            if flagged_items is items:
                if getattr(mail, "FlagStatus", 0) != 2:
                    continue
                received = getattr(mail, "ReceivedTime", None)
                if received and hasattr(received, "timetuple") and received < cutoff:
                    continue

            processed += 1
            subject = getattr(mail, "Subject", "") or ""
            body = getattr(mail, "Body", "") or ""
            sender = getattr(mail, "SenderName", "") or getattr(mail, "SenderEmailAddress", "") or ""
            entry_id = getattr(mail, "EntryID", "") or ""

            received = getattr(mail, "ReceivedTime", None)
            received_str = received.isoformat() if received and hasattr(received, "timetuple") else str(received or "")

            analysis = extract_action(subject, body, sender, received_str)

            payload = {
                "entry_id": entry_id,
                "subject": subject,
                "sender": analysis["sender"],
                "received": analysis["received"],
                "action_type": analysis["action_type"],
                "summary": analysis["summary"],
                "deadline": analysis["deadline"] or None,
                "confidence": analysis["confidence"]
            }

            resp = requests.post(
                PLAYBOOK_URL,
                json=payload,
                headers={"Authorization": f"Bearer {SYNC_KEY}"},
                timeout=15
            )

            if resp.status_code == 200:
                synced.append(payload["subject"])
                log(f"  SYNCED [{analysis['action_type']}] {payload['subject'][:80]}")
            elif resp.status_code == 409:
                log(f"  SKIP (already synced) {payload['subject'][:80]}")
            else:
                log(f"  ERROR {resp.status_code} syncing {payload['subject'][:80]}: {resp.text[:200]}")
                errors += 1

        except Exception as e:
            log(f"  ERROR processing email: {e}")
            errors += 1

    log("=" * 60)
    log(f"Sync complete: {len(synced)} synced, {processed} flagged processed, {errors} errors")
    log(f"Result: {len(synced)} actions pushed to Playbook")

    # Cleanup
    try:
        outlook_app.Quit()
    except:
        pass


if __name__ == "__main__":
    sync()