#!/c/Users/HermesAdmin/AppData/Local/Programs/Python/Python314/python.exe
"""Context Requests Poller - Cron Job - Sheet ID: 6019591785631620"""
import json, urllib.request, ssl
from datetime import date

SHEET_ID = "6019591785631620"
TODAY = date.today().isoformat()

# Read token from .env.local - format: SMARTSHEET_TOKEN="value"
env_path = r"C:\Users\HermesAdmin\Level-Up-Playbook\.env.local"
token = None
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith("SMARTSHEET_TOKEN="):
            # Extract value between quotes or after equals sign
            val = line.split("=", 1)[1]
            val = val.strip()
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            elif val.startswith("'") and val.endswith("'"):
                val = val[1:-1]
            token = val
            break

if not token:
    print("ERROR: SMARTSHEET_TOKEN not found in .env.local")
    exit(1)

ctx = ssl._create_unverified_context()

def api_call(path, method="GET", body=None):
    url = "https://api.smartsheet.com/2.0" + path
    headers = {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, context=ctx)
        return json.loads(resp.read())
    except urllib.request.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}

# Step 1: Get sheet structure
print("=== STEP 1: Fetching sheet structure ===")
sheet = api_call("/sheets/" + SHEET_ID + "?rows=all")
if "error" in sheet:
    print("ERROR fetching sheet:", sheet)
    exit(1)

col_map = {}
for col in sheet.get("columns", []):
    col_map[col["title"]] = {"id": col["id"], "type": col["type"], "options": col.get("options", [])}

print("Sheet:", sheet.get("name"))
print("Columns found:", list(col_map.keys()))
print("Total rows:", sheet.get("totalRowCount"))

# Step 2: Filter for Status=Open
print("\n=== STEP 2: Finding open rows ===")
all_rows = sheet.get("rows", [])
status_col_id = col_map["Status"]["id"]
request_type_col_id = col_map["RequestType"]["id"]
scope_col_id = col_map["Scope"]["id"]
question_col_id = col_map["Question"]["id"]
response_col_id = col_map["Response"]["id"]
answered_at_col_id = col_map["AnsweredAt"]["id"]
request_id_col_id = col_map["RequestId"]["id"]

open_rows = []
for row in all_rows:
    cells = {c["columnId"]: c.get("value", "") for c in row.get("cells", [])}
    status = cells.get(status_col_id, "")
    if status == "Open":
        open_rows.append({
            "id": row["id"],
            "rowNumber": row.get("rowNumber"),
            "requestId": cells.get(request_id_col_id, ""),
            "requestType": cells.get(request_type_col_id, ""),
            "scope": str(cells.get(scope_col_id, "")),
            "question": str(cells.get(question_col_id, "")),
        })

print("Rows with Status=Open:", len(open_rows))

if not open_rows:
    print("\nNo open rows to process. Exiting.")
    exit(0)

for r in open_rows:
    print("  Row", r["rowNumber"], ":", r["requestId"], "| Type=", r["requestType"], "| Q=", r["question"][:80])

# Step 3: Process each open row
print("\n=== STEP 3: Processing open rows ===")

results = {"answered": [], "cannot_answer": [], "awaiting_claude": [], "errors": []}

for row in open_rows:
    rid = row["id"]
    rtype = row["requestType"]
    scope = row["scope"]
    question = row["question"]
    req_id = row["requestId"]

    print("\n--- Processing Row", row["rowNumber"], "(", req_id, ") ---")
    print("  RequestType:", rtype)
    print("  Scope:", scope[:120])
    print("  Question:", question[:120])

    response_text = ""
    new_status = ""

    if rtype == "ConfidenceTriage":
        new_status = "Open"
        response_text = "Awaiting Claude - requires Claude's judgment for confidence triage."
        results["awaiting_claude"].append(row["rowNumber"])
        print("  -> Action: Awaiting Claude (keep Open)")

    elif rtype == "ThreadHistory":
        response_text = (
            "ThreadHistory request: " + scope + ". "
            "Cannot auto-query mail scan data from LUCI cron context. "
            "Requires Claude to search mail threads and summarize findings."
        )
        new_status = "CannotAnswer"
        results["cannot_answer"].append(row["rowNumber"])
        print("  -> Flagged CannotAnswer - mail scan lookup needs Claude")

    elif rtype == "SlipPattern":
        response_text = (
            "SlipPattern request: " + scope + ". "
            "Requires Claude to analyze patterns in Smartsheet/project data. "
            "LUCI cannot auto-analyze slip patterns from cron context."
        )
        new_status = "CannotAnswer"
        results["cannot_answer"].append(row["rowNumber"])
        print("  -> Flagged CannotAnswer - pattern analysis needs Claude")

    elif rtype == "PersonHistory":
        response_text = (
            "PersonHistory request: " + scope + ". "
            "Requires Claude to search mail scan data and session history for person context."
        )
        new_status = "CannotAnswer"
        results["cannot_answer"].append(row["rowNumber"])
        print("  -> Flagged CannotAnswer - person history lookup needs Claude")

    elif rtype == "CrossProject":
        response_text = (
            "CrossProject request: " + scope + ". "
            "Requires Claude to analyze across project data sources."
        )
        new_status = "CannotAnswer"
        results["cannot_answer"].append(row["rowNumber"])
        print("  -> Flagged CannotAnswer - cross-project analysis needs Claude")

    elif rtype == "HasThisComeUpBefore":
        response_text = (
            "HasThisComeUpBefore: " + scope + ". "
            "Requires Claude to search session history and determine relevance."
        )
        new_status = "CannotAnswer"
        results["cannot_answer"].append(row["rowNumber"])
        print("  -> Flagged CannotAnswer - context search needs Claude")

    elif rtype == "DocumentRead":
        new_status = "CannotAnswer"
        response_text = "Requires Claude - LUCI cannot read documents directly."
        results["cannot_answer"].append(row["rowNumber"])
        print("  -> Flagged CannotAnswer - document reading needs Claude")

    elif rtype == "Other":
        new_status = "CannotAnswer"
        response_text = "Requires Claude."
        results["cannot_answer"].append(row["rowNumber"])
        print("  -> Flagged CannotAnswer - Other type needs Claude")

    else:
        new_status = "CannotAnswer"
        response_text = "Unknown RequestType '" + rtype + "'. Requires Claude."
        results["errors"].append(row["rowNumber"])
        print("  -> Unknown type, flagged CannotAnswer")

    # Step 4: Update the row in Smartsheet
    print("  Updating row", rid, ": Status=", new_status)

    update_cells = []
    if rtype == "ConfidenceTriage":
        update_cells = [{"columnId": response_col_id, "value": response_text}]
    else:
        update_cells = [
            {"columnId": response_col_id, "value": response_text},
            {"columnId": status_col_id, "value": new_status}
        ]
        if new_status == "Answered":
            update_cells.append({"columnId": answered_at_col_id, "value": TODAY})

    body = [{"id": rid, "cells": update_cells}]
    result = api_call("/sheets/" + SHEET_ID + "/rows", method="PUT", body=body)
    if "error" in result:
        print("  ERROR updating row:", result)
        results["errors"].append(row["rowNumber"])
    else:
        print("  Successfully updated row", row["rowNumber"], ": Status=", new_status)

# Step 5: Summary
print("\n" + "=" * 60)
print("=== FINAL SUMMARY ===")
print("Total open rows found:", len(open_rows))
print("Answered:", len(results["answered"]))
print("CannotAnswer (flagged for Claude):", len(results["cannot_answer"]))
print("Awaiting Claude (kept Open):", len(results["awaiting_claude"]))
print("Errors:", len(results["errors"]))
if results["cannot_answer"]:
    print("CannotAnswer rows:", results["cannot_answer"])
if results["awaiting_claude"]:
    print("Awaiting Claude rows:", results["awaiting_claude"])
if results["errors"]:
    print("Error rows:", results["errors"])