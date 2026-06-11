# scripts/outlook_flags.py — Read flagged emails from ALL Outlook accounts via COM
# Extracts subject, sender, body preview, and generates actionable item text.
# Posts results to the Playbook API for the Briefing panel.
#
# Usage: python scripts/outlook_flags.py
# Requires: pip install pywin32 requests

import sys
import json
import time
import os
import re

SYNC_KEY = os.environ.get('LU_FLAG_SYNC_KEY', '')
API_URL = 'https://level-up-playbook.vercel.app/api/sync/flagged-store'

try:
    import win32com.client
except ImportError:
    print(json.dumps({"error": "pywin32 not installed. Run: pip install pywin32"}))
    sys.exit(1)

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests not installed. Run: pip install requests"}))
    sys.exit(1)


def extract_action_text(subject, body_preview, sender_name):
    """Generate a descriptive action item from email content"""
    subject_lower = (subject or '').lower()
    body_lower = (body_preview or '').lower()
    combined = subject_lower + ' ' + body_lower

    # Determine priority
    priority = 'medium'
    urgency_keywords = ['urgent', 'asap', 'deadline', 'overdue', 'today', 'immediately', 'critical', 'emergency',
                        'past due', 'final notice', 'time sensitive']
    high_keywords = ['review', 'approval', 'approve', 'sign', 'execute', 'respond', 'reply', 'action required',
                     'decision needed', 'please confirm', 'update needed', 'attention']
    if any(kw in combined for kw in urgency_keywords):
        priority = 'high'
    elif any(kw in combined for kw in high_keywords):
        priority = 'medium'

    # Generate a descriptive action text
    # Start with the subject line itself
    action_text = subject or '(no subject)'

    # Add key action hints from body
    action_hints = []
    hint_patterns = [
        (r'(?:please|kindly|need to)\s+(\w+(?:\s+\w+){0,4})', 'action'),
        (r'(?:requires|needs|pending)\s+(your\s+)?(\w+(?:\s+\w+){0,3})', 'need'),
        (r'(?:by|due|deadline)[:\s]+(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})', 'deadline'),
        (r'(?:enclosed|attached|see below)\s+(\w+(?:\s+\w+){0,4})', 'attachment'),
        (r'(?:budget|cost|change order|pco|spreadsheet|drawing|rfq|rfi)', 'project'),
        (r'(?:meeting|call|schedule|calendar|appointment)', 'meeting'),
    ]
    
    for pattern, category in hint_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            hint = match.group(0).strip()
            if len(hint) > 5 and hint not in action_hints:
                action_hints.append(hint[:80])

    if action_hints:
        action_text += ' | ' + '; '.join(action_hints[:2])

    return action_text, priority


def main():
    try:
        outlook = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
    except Exception as e:
        print(json.dumps({"error": f"Cannot connect to Outlook: {e}"}))
        sys.exit(1)

    all_flagged = []
    accounts_found = []

    # Iterate over all configured Outlook accounts/stores
    for store_idx in range(outlook.Stores.Count):
        try:
            store = outlook.Stores.Item(store_idx + 1)
            store_name = store.DisplayName or f"Store {store_idx+1}"
            accounts_found.append(store_name)
            
            try:
                inbox = store.GetDefaultFolder(6)  # olFolderInbox = 6
            except:
                continue

            try:
                filter_str = "[FlagStatus] = 2"  # olFlagged = 2
                items = inbox.Items.Restrict(filter_str)
                items.SetColumns("Subject,SenderName,SenderEmailAddress,ReceivedTime,ConversationID,FlagRequest,FlagDueBy,Body")
                
                count = 0
                for item in items:
                    if count >= 25:
                        break
                    try:
                        subject = item.Subject or "(no subject)"
                        sender = item.SenderName or ""
                        sender_email = item.SenderEmailAddress or ""
                        received = str(item.ReceivedTime) if item.ReceivedTime else ""
                        conv_id = item.ConversationID or ""

                        # Read body content (first 300 chars for preview)
                        body_preview = ""
                        try:
                            body = item.Body or ""
                            body = re.sub(r'\s+', ' ', body).strip()
                            body_preview = body[:300]
                        except:
                            body_preview = subject[:300]

                        # Generate action text from content
                        action_text, priority = extract_action_text(subject, body_preview, sender)

                        flagged_item = {
                            "id": conv_id or f"flag_{store_idx}_{count}",
                            "type": "flagged_email",
                            "subject": subject,
                            "text": action_text,
                            "from": sender,
                            "fromEmail": sender_email,
                            "preview": body_preview,
                            "receivedDate": received,
                            "source": "Flagged Email",
                            "account": store_name,
                            "priority": priority,
                            "status": "pending"
                        }
                        all_flagged.append(flagged_item)
                        count += 1
                    except:
                        continue
            except:
                pass

        except Exception as e:
            print(f"Warning: Store {store_idx+1} ({store_name}) error: {e}", file=sys.stderr)
            continue

    # Sort by received date (newest first)
    all_flagged.sort(key=lambda i: i.get('receivedDate', '') or '', reverse=True)

    payload = {
        "count": len(all_flagged),
        "source": "outlook_com",
        "accounts_found": accounts_found,
        "sync_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "actions": all_flagged
    }

    # Save locally
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flagged-local.json')
    with open(output_path, 'w') as f:
        json.dump(payload, f, indent=2)

    print(f"Read {len(all_flagged)} flagged items from {len(accounts_found)} accounts: {', '.join(accounts_found)}", file=sys.stderr)

    # POST to Playbook API
    if SYNC_KEY:
        try:
            r = requests.post(API_URL, json=payload, headers={
                'X-Sync-Key': SYNC_KEY,
                'Content-Type': 'application/json'
            }, timeout=15)
            if r.ok:
                print(f"Synced {len(all_flagged)} items to Playbook", file=sys.stderr)
            else:
                print(f"Sync POST failed: HTTP {r.status} — {r.text[:200]}", file=sys.stderr)
        except Exception as e:
            print(f"Sync POST error: {e}", file=sys.stderr)
    else:
        print("No LU_FLAG_SYNC_KEY set — saved locally only", file=sys.stderr)

    print(json.dumps(payload))


if __name__ == '__main__':
    main()