#!/usr/bin/env python3
"""
MFP Flagged Email Sync — reads flagged MFP emails via Outlook COM,
analyzes body content for action/context, pushes to Playbook.
Runs as a scheduled task.
"""

import json, os, sys, re, requests, win32com.client, pythoncom
from datetime import datetime, timedelta

# ── Config ──────────────────────────────────────────────────────────
PLAYBOOK_URL = "https://level-up-playbook.vercel.app/api/flagged-store"
SYNC_KEY = "59085493e8e63a164be0e443575b99f191b5c7fdb791c539"
LOOKBACK_DAYS = 60  # how far back to scan for flagged
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts", "flagged-sync.log")

# ── Helpers ──────────────────────────────────────────────────────────

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
    """
    Analyze email subject + body to extract:
    - action_type: 'action_required', 'for_review', 'for_approval', 'informational', 'decision_needed', 'follow_up'
    - summary: 1-2 line what needs to happen
    - deadline detected (if any)
    - confidence: high/medium/low
    """
    text = (subject or "") + " " + (body or "")[:3000]
    text_lower = text.lower()

    # Detect deadline patterns
    deadline = None
    deadline_patterns = [
        r'due\s+(?:by|on|date)?\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'deadline[:\s]+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'by\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
        r'(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)',
        r'response\s+(?:by|required|needed)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)',
    ]
    for pat in deadline_patterns:
        m = re.search(pat, text_lower)
        if m:
            deadline = m.group(1)[:30]
            break

    # Detect action type
    urgency = "normal"
    for word in ["urgent", "asap", "immediately", "time sensitive", "critical", "overdue", "past due"]:
        if word in text_lower:
            urgency = "high"
            break

    # Classify the action
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

    # Build a richer summary from body
    # Try to find the actionable sentence
    body_clean = re.sub(r'<[^>]+>', '', (body or ""))  # strip HTML
    body_clean = re.sub(r'\s+', ' ', body_clean)[:2000]

    # Extract first meaningful sentence
    for sep in ['\n\n', '\r\n\r\n']:
        if sep in body_clean:
            paragraphs = body_clean.split(sep)
            for p in paragraphs:
                p = p.strip()
                if len(p) > 20 and not p.startswith('>') and not p.startswith('On ') and 'wrote:' not in p:
                    # Check if it sounds actionable
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
    pythoncom.CoInitialize()
    log("=" * 60)
    log("MFP Flagged Email Sync starting")

    outlook = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")

    # Find MFP store
    store_mfp = None
    for s in outlook.Stores:
        if "Whitney.Williams@miamifreedompark.com" in s.DisplayName and "Archive" not in s.DisplayName:
            store_mfp = s
            break

    if not store_mfp:
        log("ERROR: MFP store not found")
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

    # Get flagged items from inbox
    items = inbox.Items
    items.Sort("[ReceivedTime]", True)

    cutoff = datetime.now() - timedelta(days=LOOKBACK_DAYS)
    actions = []

    for item in items:
        try:
            received = item.ReceivedTime
            if received and hasattr(received, "timetuple"):
                received_dt = received
            else:
                received_dt = datetime.now()

            if received_dt < cutoff:
                continue  # skip old emails

            flag_status = item.FlagStatus
            if flag_status not in [1, 2]:  # 1=flagged, 2=complete
                continue

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

    # Build payload
    payload = {
        "actions": actions,
        "source": "mfp_com_local",
        "_count": len(actions),
        "_scanned_at": datetime.now().isoformat()
    }

    # POST to Playbook
    log(f"Posting {len(actions)} actions to Playbook...")
    try:
        resp = requests.post(
            PLAYBOOK_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "x-sync-key": SYNC_KEY
            },
            timeout=30
        )
        if resp.ok:
            result = resp.json()
            log(f"Sync OK: {result.get('count', 0)} actions stored")
        else:
            log(f"Sync FAILED: HTTP {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        log(f"Sync ERROR: {e}")

    # Also write local backup
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