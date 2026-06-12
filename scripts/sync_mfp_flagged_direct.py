#!/usr/bin/env python3
"""
MFP Flagged Email Sync — direct (no threading) variant for session 0.
"""
import json, os, sys, re, requests, win32com.client, pythoncom
from datetime import datetime, timedelta

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
    text = (subject or "") + " " + (body or "")[:3000]
    text_lower = text.lower()

    deadline = None
    deadline_patterns = [
        r'due\s+(?:by|on|date)?\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'deadline[:\\s]+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'by\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)',
        r'response\s+(?:by|required|needed)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)',
    ]
    for pat in deadline_patterns:
        m = re.search(pat, text_lower)
        if m:
            deadline = m.group(1)[:30]
            break

    urgency = "normal"
    for word in ["urgent", "asap", "immediately", "time sensitive", "critical", "overdue", "past due"]:
        if word in text_lower:
            urgency = "high"
            break

    action_type = "follow_up"
    summary = subject or "(No subject)"

    if any(w in text_lower for w in ["please sign", "approval needed", "for your approval", "approve", "executed"]):
        action_type = "for_approval"
        summary = f"Approve: {subject}"
    elif any(w in text_lower for w in ["please review", "for your review", "review needed", "feedback needed"]):
        action_type = "for_review"
        summary = f"Review: {subject}"
    elif any(w in text_lower for w in ["please respond", "response needed", "your input", "decision needed",
                                         "what do you think", "let me know", "please advise", "action required"]):
        action_type = "decision_needed"
        summary = f"Decision needed: {subject}"
    elif any(w in text_lower for w in ["action required", "please complete", "need you to", "please provide",
                                         "please submit", "todo", "to-do"]):
        action_type = "action_required"
        summary = f"Action: {subject}"
    elif any(w in text_lower for w in ["fyi", "for your information", "update", "status", "progress"]):
        action_type = "informational"
        summary = f"Update: {subject}"

    body_clean = re.sub(r'<[^>]+>', '', (body or ""))
    body_clean = re.sub(r'\s+', ' ', body_clean)[:2000]

    for sep in ['\n\n', '\r\n\r\n']:
        if sep in body_clean:
            paragraphs = body_clean.split(sep)
            for p in paragraphs:
                p = p.strip()
                if len(p) > 20 and not p.startswith('>') and not p.startswith('On ') and 'wrote:' not in p:
                    if any(w in p.lower() for w in ['please', 'can you', 'could you', 'need', 'required',
                                                      'let me know', 'send', 'review', 'approve', 'confirm']):
                        summary = p[:200]
                        break

    result = {
        "subject": (subject or "")[:200],
        "from": sender or "Unknown",
        "received": received.isoformat() if received else datetime.now().isoformat(),
        "action_type": action_type,
        "summary": summary[:300],
        "urgency": urgency,
        "deadline": deadline if deadline else None,
        "has_deadline": deadline is not None,
        "source": "MFP (Flagged)",
        "status": "open" if urgency == "high" else ("open" if action_type != "informational" else "read"),
    }
    return result

def sync():
    pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
    log("=" * 60)
    log("MFP Flagged Email Sync starting (direct mode)")

    outlook_app = None
    try:
        outlook_app = win32com.client.Dispatch("Outlook.Application")
        log("Outlook Dispatch OK")
    except Exception as e:
        log(f"ERROR: Outlook COM dispatch failed: {e}")
        return

    try:
        outlook = outlook_app.GetNamespace("MAPI")
        log("MAPI namespace OK")
    except AttributeError as e:
        log(f"ERROR: GetNamespace failed — MAPI may not be available: {e}")
        return

    store_mfp = None
    for s in outlook.Stores:
        if "Whitney.Williams@miamifreedompark.com" in s.DisplayName and "Archive" not in s.DisplayName:
            store_mfp = s
            break

    if not store_mfp:
        log("ERROR: MFP store not found. Available stores:")
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

    items = inbox.Items
    items.Sort("[ReceivedTime]", True)

    now = datetime.now()
    cutoff = now - timedelta(days=LOOKBACK_DAYS)
    cutoff_str = cutoff.strftime("%m/%d/%Y %I:%M %p")

    # Restrict to only flagged items — avoids iterating the entire inbox
    filter_str = f"[FlagStatus] = 2 AND [ReceivedTime] >= '{cutoff_str}'"
    log(f"Filter: {filter_str}")
    try:
        flagged_items = items.Restrict(filter_str)
    except Exception as e:
        log(f"WARNING: Restrict failed ({e}), falling back to full iteration")
        flagged_items = items

    actions = []

    for item in flagged_items:
        try:
            received = item.ReceivedTime
            if hasattr(received, "timetuple"):
                received_dt = received
            else:
                received_dt = datetime.now().astimezone()

            subject = item.Subject or ""
            sender = item.SenderName or item.SenderEmailAddress or "MFP"
            body = item.Body or ""

            log(f"  Processing flagged: {sender} - {subject[:60]}")

            action = extract_action(subject, body, sender, received_dt)
            actions.append(action)

        except Exception as e:
            log(f"  Error processing item: {e}")
            continue

    log(f"Found {len(actions)} flagged emails with actions extracted")

    if not actions:
        log("Nothing to sync")
        return

    payload = {
        "actions": actions,
        "source": "mfp_com_local",
        "_count": len(actions),
        "_scanned_at": datetime.now().isoformat()
    }

    log(f"Posting {len(actions)} actions to Playbook...")
    try:
        resp = requests.post(
            PLAYBOOK_URL,
            json=payload,
            headers={"Content-Type": "application/json", "x-sync-key": SYNC_KEY},
            timeout=30
        )
        if resp.ok:
            result = resp.json()
            log(f"Sync OK: {result.get('count', 0)} actions stored")
        else:
            log(f"Sync FAILED: HTTP {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        log(f"Sync ERROR: {e}")

    backup_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts", "flagged-local.json")
    try:
        with open(backup_path, "w") as f:
            json.dump(payload, f, indent=2, default=str)
        log(f"Local backup written to {backup_path}")
    except Exception as e:
        log(f"Backup write error: {e}")

    log(f"Sync complete ({len(actions)} actions)")
    log("=" * 60)

if __name__ == "__main__":
    sync()