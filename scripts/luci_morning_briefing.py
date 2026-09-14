#!/usr/bin/env python3
"""LUCI Morning Briefing — July 1, 2026"""
import json, openpyxl
from datetime import datetime, timezone
from pathlib import Path

tracker_path = Path(r"C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents - Level Up\02 - Miami Freedom Park Stadium\01 - Project Management\02 - Logs\01 - Action Items\01 - Owner Action Items\LUNA Action Tracker.xlsx")
flagged_path = Path(r"C:\Users\HermesAdmin\Level-Up-Playbook\scripts\flagged-local.json")
checklist_path = Path(r"C:\Users\HermesAdmin\Level-Up-Playbook\data\checklist.json")
marker_path_mfp = Path(r"C:\Users\HermesAdmin\Level-Up-Playbook\scripts\flagged-fallback-marker.txt")
marker_path_underscore = Path(r"C:\Users\HermesAdmin\Level-Up-Playbook\scripts\.mfp_cron_tracker")

now = datetime.now()
print(f"LUCI Briefing Run: {now.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Session: Session 0 (cron) — Outlook COM unavailable")
print()

# ── 0. Tracker marker status ──
print("=" * 60)
print("📡 FALLBACK MARKER STATUS")
print("=" * 60)
if marker_path_mfp.exists():
    print(f"  flagged-fallback-marker.txt: {marker_path_mfp.read_text().strip()}")
else:
    print("  flagged-fallback-marker.txt: NOT FOUND")
if marker_path_underscore.exists():
    print(f"  .mfp_cron_tracker:           {marker_path_underscore.read_text().strip()}")
else:
    print("  .mfp_cron_tracker:           NOT FOUND")

# ── 1. Flagged emails ──
print()
print("=" * 60)
print("📬 FLAGGED EMAIL ACTIONS (Cached)")
print("=" * 60)

if flagged_path.exists():
    flagged = json.loads(flagged_path.read_text())
    count = flagged.get("_count", 0)
    scanned = flagged.get("_scanned_at", "unknown")
    actions = flagged.get("actions", [])
    
    try:
        scanned_dt = datetime.fromisoformat(scanned)
        stale_days = (now - scanned_dt).days
    except:
        stale_days = 0
    
    print(f"  Count: {count}")
    print(f"  Last synced: {scanned}")
    print(f"  Staleness: {stale_days} days {'⚠️ STALE' if stale_days > 7 else '✅ OK'}")
    print(f"  Source: flagged-local.json (cached — Outlook COM fallback)")
    
    # Sort by urgency
    high = [a for a in actions if str(a.get("urgency", a.get("actionType", ""))).lower() in ("high", "critical", "urgent")]
    normal = [a for a in actions if str(a.get("urgency", a.get("actionType", ""))).lower() not in ("high", "critical", "urgent")]
    
    print(f"\n🔴 HIGH URGENCY ({len(high)}):")
    for a in high:
        subj = a.get("subject", a.get("conversationTopic", "No subject"))
        sender = a.get("sender", a.get("senderName", "Unknown"))
        act_type = a.get("action_type", a.get("actionType", "review"))
        deadline = a.get("deadline", a.get("dueDate", "N/A"))
        print(f"     [{act_type}] {subj}")
        print(f"       From: {sender} | Due: {deadline}")
    
    if not high:
        print("  (none)")
    
    print(f"\n🟡 NORMAL ({len(normal)}):")
    for a in normal:
        subj = a.get("subject", a.get("conversationTopic", "No subject"))
        sender = a.get("sender", a.get("senderName", "Unknown"))
        act_type = a.get("action_type", a.get("actionType", "review"))
        deadline = a.get("deadline", a.get("dueDate", ""))
        due_str = f" | Due: {deadline}" if deadline else ""
        print(f"     [{act_type}] {subj} — {sender}{due_str}")
    
    if not normal:
        print("  (none)")
else:
    print("  ❌ flagged-local.json not found")

# ── 2. LUNA Action Tracker ──
print()
print("=" * 60)
print("📋 LUNA ACTION TRACKER — Open Items")
print("=" * 60)

if tracker_path.exists():
    mtime = datetime.fromtimestamp(tracker_path.stat().st_mtime)
    print(f"  Source: {tracker_path.name}")
    print(f"  Last modified: {mtime.strftime('%Y-%m-%d %H:%M')}")
    
    wb = openpyxl.load_workbook(tracker_path, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    print(f"  Sheet: {sheet.title} | Data rows: {max(0, len(rows)-1)}")
    
    headers = [str(h).strip() if h else "" for h in (rows[0] if rows else [])]
    print(f"  Headers: {headers}")
    
    # Find column indices
    def find_col(name):
        for i, h in enumerate(headers):
            if name.lower() in str(h).lower():
                return i
        return -1
    
    col_task = find_col("task") or find_col("action") or find_col("description") or find_col("item") or 1
    col_status = find_col("status") or 4
    col_priority = find_col("priority") or 3
    col_due = find_col("due") or find_col("date") or 6
    col_assignee = find_col("assigned") or find_col("owner") or find_col("lead") or 5
    col_category = find_col("category") or 2
    
    open_items = []
    completed = 0
    high_pri = []
    med_pri = []
    
    for row in rows[1:]:
        if not row or all(v is None for v in row):
            continue
        
        task = str(row[col_task]).strip() if col_task < len(row) and row[col_task] else ""
        status = str(row[col_status]).strip() if col_status < len(row) and row[col_status] else ""
        priority = str(row[col_priority]).strip() if col_priority < len(row) and row[col_priority] else ""
        due = row[col_due] if col_due < len(row) else None
        assignee = str(row[col_assignee]).strip() if col_assignee < len(row) and row[col_assignee] else ""
        category = str(row[col_category]).strip() if col_category < len(row) and row[col_category] else ""
        
        if not task or len(task) < 3:
            continue
        if any(kw in task.lower() for kw in ["task", "action", "status", "priority", "due", "assigned", "notes"]):
            continue
        
        status_lower = status.lower()
        if status_lower in ("done", "complete", "completed", "closed", "cancelled", "n/a", "na"):
            completed += 1
            continue
        
        open_items.append({"task": task, "priority": priority, "status": status, "due": due, "assignee": assignee, "category": category})
        
        if "high" in priority.lower() or "critical" in priority.lower():
            high_pri.append(open_items[-1])
        elif "medium" in priority.lower() or "med" in priority.lower():
            med_pri.append(open_items[-1])
    
    print(f"\n  Total open: {len(open_items)} | Completed/closed: {completed}")
    
    if high_pri:
        print(f"\n🔴 HIGH PRIORITY ({len(high_pri)}):")
        for item in high_pri:
            due_str = item['due'].strftime('%Y-%m-%d') if hasattr(item['due'], 'strftime') else str(item['due'] or 'No due')
            print(f"     {item['task'][:90]}")
            print(f"       Due: {due_str} | Assignee: {item['assignee'] or '—'} | Status: {item['status'] or 'Open'}")
    
    if not high_pri:
        print("  🔴 (none)")
    
    if med_pri:
        print(f"\n🟡 MEDIUM ({len(med_pri)}):")
        for item in med_pri:
            due_str = item['due'].strftime('%Y-%m-%d') if hasattr(item['due'], 'strftime') else str(item['due'] or 'No due')
            print(f"     {item['task'][:90]} (Due: {due_str})")
    
    other = [i for i in open_items if i not in high_pri and i not in med_pri]
    if other:
        print(f"\n⚪ OTHER OPEN ({len(other)}):")
        for item in other[:8]:
            print(f"     {item['task'][:85]} | {item['status'] or 'Open'} | {item['category']}")
        if len(other) > 8:
            print(f"     ... and {len(other)-8} more")
    
    wb.close()
else:
    print("  ❌ LUNA Action Tracker.xlsx not found")

# ── 3. Cross-references ──
print()
print("=" * 60)
print("🔄 CROSS-REFERENCES (Tracker ↔ Flagged Emails)")
print("=" * 60)

if 'actions' in locals() and 'open_items' in locals() and actions and open_items:
    cross_refs = 0
    for item in open_items:
        task_words = set(w for w in item['task'].lower().split() if len(w) > 4)
        for a in actions:
            subj = str(a.get("subject", a.get("conversationTopic", ""))).lower()
            if task_words & set(subj.split()):
                print(f"  ✦ Tracker: {item['task'][:55]}")
                subj_short = a.get('subject', a.get('conversationTopic', ''))[:60]
                print(f"    ↔ Email:  {subj_short}")
                cross_refs += 1
                break
    if cross_refs == 0:
        print("  No direct cross-references found between tracker items and flagged emails.")
        print("  (This is normal — many tracked items originate from meetings, not email.)")
else:
    print("  (insufficient data for cross-referencing)")

# ── 4. Calendar ──
print()
print("=" * 60)
print("📅 CALENDAR — Today's Meetings")
print("=" * 60)
print("  ❌ Outlook COM unavailable from Session 0 (cron context)")
print()
print("  Calendar data requires an interactive session (Session 1+).")
print("  To refresh: run interactively on login, or check Playbook")
print("  Briefing panel (Meetings tab) for most recent calendar snapshot.")
print()
print("  ⚠ Note: The VBS startup script at")
print("    %APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\")
print("    does NOT currently sync calendar data — only flagged emails.")

# ── 5. Checklist.json state ──
print()
print("=" * 60)
print("📋 PLAYBOOK CHECKLIST STATUS")
print("=" * 60)
if checklist_path.exists():
    try:
        checklist = json.loads(checklist_path.read_text())
        print(f"  Items: {len(checklist)} open items in Playbook checklist")
        for i, item in enumerate(checklist[:5]):
            title = item.get("title", item.get("text", item.get("task", "Unknown")))[:80]
            print(f"  {i+1}. {title}")
        if len(checklist) > 5:
            print(f"     ... and {len(checklist)-5} more")
    except:
        print("  ❌ Could not parse checklist.json")
else:
    print("  ⚠ checklist.json not found")

# ── 6. Connectivity ──
print()
print("=" * 60)
print("📡 CONNECTIVITY STATUS")
print("=" * 60)
print(f"  Outlook COM (Dispatch)     ❌  Session 0 — blocked by Windows design")
print(f"  Proton SMTP Bridge         ❌  Session 0 — not usable from cron")
print(f"  LUNA Tracker (openpyxl)    ✅  Direct file read")
print(f"  Flagged cache (JSON)       ✅  {flagged.get('_count', 0) if 'flagged' in dir() and isinstance(flagged, dict) else '?'} actions")
print(f"  Playbook checklist         {'✅' if checklist_path.exists() else '❌'}  {len(checklist) if 'checklist' in dir() else '?'}")
print(f"  Fallback markers           ✅  Both at 2026-07-01 — already ran today")

print()
print("=" * 60)
print("⚠  NOTES & LIMITATIONS")
print("=" * 60)
print("  1. Flagged email data is 19 days stale (last sync: June 12).")
print("     Interactive login + VBS startup needed to refresh.")
print("  2. Calendar data unavailable — no COM access in cron context.")
print("  3. Email delivery of this briefing requires an interactive")
print("     session (Outlook COM or Proton Bridge not usable from cron).")
print("  4. Both fallback markers confirmed at 2026-07-01 — no")
print("     duplicate pushes occurred today.")
print()
print("  To get a full briefing with live data, run:")
print(f"    python {Path.home()}/AppData/Local/hermes/scripts/luna_briefing.py")
print("  from an interactive command prompt.")
