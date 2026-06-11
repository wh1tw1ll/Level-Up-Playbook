import re

with open('data/mfp_financials.js', 'r') as f:
    content = f.read()

# Extract existing contract numbers
existing = {}
for m in re.finditer(r'company:"([^"]+)",title:"([^"]+)",contract:"([^"]+)"', content):
    existing[m.group(1).upper()] = m.group(3)

# LIVEPROCORE: Verified data from Commitments table (24 visible rows)
# Format: (company, title, orig, co, revised, invoiced, paid, pct_paid, balance)
live_data = [
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

# Right Way Plumbing data (existing file - contract exists in Procore as SC-004 but was collapsed in view)
rw_data = ("RIGHT WAY PLUMBING & MECHANICAL LLC", "Underground Plumbing", 19889328.00, 299971.77, 20189299.77, 19179835.11, 15093373.49, 74.76, 5095926.28)

# Procore totals row (verified from Commitments table footer)
proc_orig = 484725419.99
proc_approved_co = 20679147.32
proc_revised = 505404567.31
proc_pending_co = 4825759.17
proc_invoiced = 459198110.66
proc_paid = 399979579.48
proc_pct_paid = 79.14
proc_balance = 105424987.83

# Add Right Way to the list
all_data = list(live_data) + [rw_data]

# Get contract numbers
def get_contract(company):
    key = company.upper()
    if key in existing:
        return existing[key]
    for ek, ec in existing.items():
        if key.startswith(ek[:15]) or ek.startswith(key[:15]):
            return ec
    return "UNKNOWN"

# Build new commitments array
new_c = []
for comp, t, orig, co, rev, inv, paid, pct, bal in all_data:
    cnum = get_contract(comp)
    new_c.append(f'      {{company:"{comp}",title:"{t}",contract:"{cnum}",orig:{orig:.2f},co:{co:.2f},revised:{rev:.2f},invoiced:{inv:.2f},paid:{paid:.2f},pct_paid:{pct:.2f},balance:{bal:.2f}}}')

new_commitments_str = ',\n'.join(new_c)

# Build the new hard costs section
new_hard = f'''  hard: {{
    total_original: {proc_orig:.2f},
    total_approved_cos: {proc_approved_co:.2f},
    total_revised: {proc_revised:.2f},
    total_pending_cos: {proc_pending_co:.2f},
    total_invoiced: {proc_invoiced:.2f},
    total_paid: {proc_paid:.2f},
    total_pct_paid: {proc_pct_paid:.2f},
    total_balance: {proc_balance:.2f},
    // 25 subcontractors, 25 contracts from Procore Commitments (live — June 2026)
    commitments: [
{new_commitments_str}
    ]'''

# Find old hard section and replace
old_start = content.find('  hard: {')
old_end = content.find('  soft:', old_start)
new_content = content[:old_start] + new_hard + ',\n' + content[old_end:]

# Update summary section
# paid_to_date = Procore "Payments Issued" total
new_content = re.sub(r'paid_to_date:\s*[0-9.]+', f'paid_to_date: {proc_paid:.2f}', new_content)
new_content = re.sub(r'incurred_to_date:\s*[0-9.]+', f'incurred_to_date: {proc_invoiced:.2f}', new_content)
new_content = re.sub(r'stadium_base_contract:\s*[0-9.]+', f'stadium_base_contract: {proc_revised:.2f}', new_content)

# Write file
with open('data/mfp_financials.js', 'w') as f:
    f.write(new_content)

# Print summary
print("=== UPDATED mfp_financials.js with LIVE PROCORE DATA ===")
print(f"Total Original:     ${proc_orig:>12,.2f}")
print(f"Total Approved COs: ${proc_approved_co:>12,.2f}")
print(f"Total Revised:      ${proc_revised:>12,.2f}")
print(f"Total Invoiced:     ${proc_invoiced:>12,.2f}")
print(f"Total Paid:         ${proc_paid:>12,.2f}")
print(f"% Paid:             {proc_pct_paid:>10.2f}%")
print(f"Total Balance:      ${proc_balance:>12,.2f}")
print(f"Contracts: {len(all_data)} (24 visible + Right Way from file)")
print()
print("=== KEY CHANGES FROM PREVIOUS FILE ===")
print("Sprinklermatic: CO went from $454,716 → $575,928 (+$121,212)")
print("GenServe: now includes negative CO adjustment")
# Verify the data
total_orig_check = sum(d[2] for d in all_data)
total_rev_check = sum(d[4] for d in all_data)
print(f"\nSum of individual orig: ${total_orig_check:,.2f}")
print(f"Sum of individual rev:  ${total_rev_check:,.2f}")
print(f"Procore totals row:     ${proc_orig:,.2f} / ${proc_revised:,.2f}")
# The gap is the grouped/hidden contracts
print(f"Gap (grouped contracts): ${proc_orig - total_orig_check:,.2f}")