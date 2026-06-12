import sys, json, subprocess
TOKEN = sys.argv[1]
WS_ID = 180213104568196
r = subprocess.run(["curl", "-s", "https://api.smartsheet.com/2.0/workspaces/" + str(WS_ID),
    "-H", "Authorization: Bearer " + TOKEN,
    "-H", "Content-Type: application/json"],
    capture_output=True, text=True, timeout=15)
d = json.loads(r.stdout)
sheets = sorted(d.get("sheets", []), key=lambda s: s["name"])
config = {}
for s in sheets:
    key = s["name"][:2]
    config[key] = {"sheetId": s["id"], "name": s["name"], "permalink": s["permalink"]}
    print(key, s["name"], "->", s["id"])
with open("config/chiefs-sheets.json", "w") as f:
    json.dump(config, f, indent=2)
print("\nWritten", len(config), "sheets")