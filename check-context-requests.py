#!/c/Users/HermesAdmin/AppData/Local/Programs/Python/Python314/python.exe
"""Quick dump of Context Requests sheet - all rows"""
import json, urllib.request, ssl

env_path = r"C:\Users\HermesAdmin\Level-Up-Playbook\.env.local"
token = None
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith("SMARTSHEET_TOKEN="):
            val = line.split("=", 1)[1].strip()
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            elif val.startswith("'") and val.endswith("'"):
                val = val[1:-1]
            token = val
            break

ctx = ssl._create_unverified_context()
req = urllib.request.Request(
    "https://api.smartsheet.com/2.0/sheets/6019591785631620?rows=all",
    headers={"Authorization": "Bearer " + token}
)
sheet = json.loads(urllib.request.urlopen(req, context=ctx).read())

print("Sheet:", sheet["name"])
print("Total rows:", sheet.get("totalRowCount"))
print()

# Column name map
col_names = {}
for c in sheet.get("columns", []):
    col_names[c["id"]] = c["title"]

for row in sheet.get("rows", []):
    print("--- Row", row.get("rowNumber"), "---")
    cells = {c["columnId"]: c.get("value", "") for c in row.get("cells", [])}
    for cid, title in col_names.items():
        val = cells.get(cid, "")
        print(f"  {title}: {val}")
    print()