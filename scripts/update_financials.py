import re

# Read current file
with open('data/mfp_financials.js', 'r') as f:
    content = f.read()

# Parse existing contract numbers by company name
pattern = r'company:"([^"]+)",title:"([^"]+)",contract:"([^"]+)"'
existing = {}
for m in re.finditer(pattern, content):
    existing[m.group(1).upper()] = (m.group(2), m.group(3))

# Live Procore Commitments data (extracted via browser console)
# Fields: Company | Title | Original | Approved COs | Revised | Invoiced | Paid | % Paid | Balance
live_rows = [
    ("QUALICO STEEL CO., INC.", "Structural Steel", 12754688.00, 3789983.12, 16544671.12, 16544671.12, 16309671.12, 98.58, 235000.00),
    ("Metromont LLC", "Precast — Metromont", 13296238.00, 3440069.26, 16736307.26, 15072447.79, 15072448.28, 90.06, 1663858.98),
    ("BAKER CONCRETE CONSTRUCTION INC.", "Cast-in-Place Concrete", 51490000.00, 10309815.07, 61799815.07, 59104998.88, 57071802.07, 92.35, 4728013.00),
    ("GENSERVE LLC", "Emergency Generator", 1436212.85, -65770.50, 1370442.35, 1323463.42, 1323463.42, 96.57, 46978.93),
    ("PROFESSIONAL SERVICE INDUSTRIES, INC.", "Geotechnical Engineering", 7500.00, 15000.00, 22500.00, 9542.50, 0.00, 0.00, 22500.00),
    ("HERRERA COMMUNICATIONS, LLC DBA FAST SIGNS", "Signage", 1074.43, 0.00, 1074.43, 0.00, 0.00, 0.00, 1074.43),
    ("ENCLOS TENSILE STRUCTURES, INC.", "Canopy Steel", 32035629.00, -32035629.00, 0.00, 0.00, 0.00, 0.00, 0.00),
    ("Aicher Steel Americas", "Anchor Bolts", 289596.34, 50311.54, 339907.88, 339907.88, 339907.88, 100.00, 0.00),
    ("Modern Heavy Industries", "Roof Canopy Structural Steel", 9585352.00, 1790960.89, 11376312.89, 11376312.89, 10238681.61, 90.00, 1137631.28),
    ("GEORGE'S WELDING SERVICES, INC.", "Canopy Anchor Bolt Templates", 29930.00, 52132.00, 82062.00, 82062.00, 82062.00, 100.00, 0.00),
    ("ATLANTIC DOORS & HARDWARE, INC.", "Doors and Hardware", 15859.54, 0.00, 15859.54, 15859.54, 15859.54, 100.00, 0.00),
    ("R.J. Watson, Inc.", "High Load Multirotational Disc Bearings", 456856.12, 61098.00, 517954.12, 517954.12, 517953.40, 100.00, 0.72),
    ("WORLD ELECTRIC SUPPLY, INC.", "Switchgears", 1653104.12, 266486.02, 1919590.14, 1887584.67, 1859686.67, 96.88, 59903.47),
    ("G-FORCE WATERPROOFING & RESTORATION, LLC", "Waterproofing", 498126.60, 84948.45, 583075.05, 583075.05, 499832.99, 85.72, 83242.06),
    ("S&R Enterprises Steel LLC", "Canopy Superstructure — Steel Erection", 6945600.00, 3413885.69, 10359485.69, 9285832.77, 7813411.22, 75.42, 2546074.47),
    ("GEORGE'S WELDING SERVICES, INC.", "Misc Metals", 4650000.00, -246167.11, 4403832.89, 3923624.53, 1865271.96, 42.36, 2538560.93),
    ("DECKTIGHT ROOFING SERVICES, INC. (D)", "Roofing", 3739640.28, 133234.38, 3872874.66, 3143237.53, 2862285.13, 73.91, 1010589.53),
    ("HYDROWORX INTERNATIONAL INC.", "Hydrotherapy Pools", 83766.00, 4000.00, 87766.00, 83766.00, 83766.00, 95.44, 4000.00),
    ("O&R CONSTRUCTION SERVICES LLC", "Masonry", 9412636.37, -870987.05, 8541649.32, 8541649.32, 7622461.81, 89.24, 919187.51),
    ("ALPHACLADDING LLC", "Glazing and Glass Railing", 8480945.68, 1370701.81, 9851647.49, 9335360.34, 6496219.84, 65.94, 3355427.65),
    ("TK ELEVATOR CORPORATION", "Elevators", 3707729.03, 874321.07, 4582050.10, 4121886.57, 3628929.65, 79.20, 953120.45),
    ("SPRINKLERMATIC FIRE PROTECTION SYSTEMS, INC.", "Fire Suppression", 2317180.00, 575928.00, 2893108.00, 2494706.39, 2005410.60, 69.32, 887697.40),
    ("MILLER ELECTRIC COMPANY", "Electrical", 76286182.00, 8614132.75, 84900314.75, 76859167.34, 66494694.10, 78.32, 18405620.65),
    ("Alliance Verdi USA, LLC d/b/a Alliance USA", "EIFS-Stucco", 2855120.00, 861558.70, 3716678.70, 3283651.58, 2844528.47, 76.53, 872150.23),
]

# Map company -> contract number
def get_contract(company_name):
    key = company_name.upper()
    if key in existing:
        return existing[key][1]
    # Try partial match
    for ek, (et, ec) in existing.items():
        if ek.startswith(key[:20]) or key.startswith(ek[:20]):
            return ec
    return "UNKNOWN"

# Build new commitments lines
new_lines = []
for comp, title, orig, co, rev, inv, paid, pct, bal in live_rows:
    cnum = get_contract(comp)
    # Clean title - remove underscorified names
    t = title
    line = f'      {{company:"{comp}",title:"{t}",contract:"{cnum}",orig:{orig:.2f},co:{co:.2f},revised:{rev:.2f},invoiced:{inv:.2f},paid:{paid:.2f},pct_paid:{pct:.2f},balance:{bal:.2f}}}'
    new_lines.append(line)

new_commitments_str = ',\n'.join(new_lines)

# Calculate totals
t_orig = sum(r[2] for r in live_rows)
t_co = sum(r[3] for r in live_rows)
t_rev = sum(r[4] for r in live_rows)
t_inv = sum(r[5] for r in live_rows)
t_paid = sum(r[6] for r in live_rows)
t_pct = t_paid / t_rev * 100
t_bal = sum(r[8] for r in live_rows)

print(f'=== LIVE PROCORE COMMITMENTS TOTALS ===')
print(f'Total Original:     ${t_orig:>12,.2f}')
print(f'Total Approved COs: ${t_co:>12,.2f}')
print(f'Total Revised:      ${t_rev:>12,.2f}')
print(f'Total Invoiced:     ${t_inv:>12,.2f}')
print(f'Total Paid:         ${t_paid:>12,.2f}')
print(f'% Paid:             {t_pct:>11.2f}%')
print(f'Total Balance:      ${t_bal:>12,.2f}')
print(f'Count: {len(live_rows)} commitments')
print()

# Now build the full updated file
# Find the section to replace
old_start = content.find('    commitments: [')
old_end = content.find('    ]', old_start) + len('    ]')

# Build new totals area
new_totals = f'''  hard: {{
    total_original: {t_orig:.2f},
    total_approved_cos: {t_co:.2f},
    total_revised: {t_rev:.2f},
    total_pending_cos: 4825759.17,
    total_invoiced: {t_inv:.2f},
    total_paid: {t_paid:.2f},
    total_pct_paid: {t_pct:.2f},
    total_balance: {t_bal:.2f},
    // 24 subcontractors, 24 contracts from Procore (live)
    commitments: [
{new_commitments_str}
    ]'''

# Replace the hard costs section
old_hard_start = content.find('  hard: {')
old_hard_end = content.find('  soft:', old_hard_start)

new_content = content[:old_hard_start] + new_totals + ',\n' + content[old_hard_end:]

# Also update the summary section totals
# Find paid_to_date, incurred_to_date, past_due
old_paid = re.search(r'paid_to_date:\s*[0-9.]+', new_content)
if old_paid:
    new_content = new_content[:old_paid.start()] + f'paid_to_date: {t_paid:.2f}' + new_content[old_paid.end():]

old_incurred = re.search(r'incurred_to_date:\s*[0-9.]+', new_content)
if old_incurred:
    new_content = new_content[:old_incurred.start()] + f'incurred_to_date: {t_paid:.2f}' + new_content[old_incurred.end():]

old_past_due = re.search(r'past_due:\s*[0-9.]+', new_content)
# We can't easily compute past_due from table data, leave as is
# But update stadium_base_contract
old_stadium = re.search(r'stadium_base_contract:\s*[0-9.]+', new_content)
if old_stadium:
    new_content = new_content[:old_stadium.start()] + f'stadium_base_contract: {t_rev:.2f}' + new_content[old_stadium.end():]

# Write the file
with open('data/mfp_financials.js', 'w') as f:
    f.write(new_content)

print("✅ mfp_financials.js updated successfully!")
print(f"File size: {len(new_content):,} bytes")