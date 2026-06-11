import os, json

BASE = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal"

contracts = []

# CMA
cma = os.path.join(BASE, "01 - Construction Manager Agreement/Inter Miami Stadium-Lemartec -- CM as Agent Agreement FINAL - 03-31-25.pdf")
if os.path.exists(cma):
    contracts.append((cma, "CMA", "Lemartec Corporation", "Construction Manager", os.path.getsize(cma)))

# Design
manica = os.path.join(BASE, "03 - Design Team/301-303 - Design Architect/MANICA/Complete_with_DocuSign_MFP_--_Design Architect (FE).pdf")
if os.path.exists(manica):
    contracts.append((manica, "MANICA", "MANICA Architecture", "Design Architect", os.path.getsize(manica)))

aor = os.path.join(BASE, "03 - Design Team/301-303 - Design Architect/Agreement for AOR Services (Execution Copy (FE)).pdf")
if os.path.exists(aor):
    contracts.append((aor, "ARQ", "Arquitectonica International Corp.", "Architect of Record", os.path.getsize(aor)))

# Trade subcontracts
TRADE = BASE + "/05 - Trade Contracts"

trade_list = [
    ("01 - Baker (CIP Concrete)/Executed Subcontract/MFP-Lemartec_--_Baker_Trade_Agreement_Kc_11.6.24.pdf", "Baker Concrete", "BAKER CONCRETE CONSTRUCTION INC."),
    ("02 - Qualico (Structural Steel)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Qualico Ste.pdf", "Qualico Steel", "QUALICO STEEL CO., INC."),
    ("03 - Metromont (Precast)/Executed Subcontract/MFP-Lemartec Trade Contractor Agreement Met.pdf", "Metromont", "Metromont LLC"),
    ("04 - Right Way (Plumbing)/Executed Subcontract/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Right Way Plumbing", "RIGHT WAY PLUMBING & MECHANICAL LLC"),
    ("05 - Hill York (Mechanical)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Hill.pdf", "Hill York", "HILL YORK SERVICE COMPANY, LLC"),
    ("27 - DeckTight Roofing/MFP-Lemartec -- Trade Contractor Agreement Decktight Roofing_Fully Executed 02.27.2025.pdf", "Decktight Roofing", "DECKTIGHT ROOFING SERVICES, INC. (D)"),
    ("29 - Venur/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Venur", "VENUR CONSTRUCTION LLC"),
    ("28 - Atlantic Doors/19069-PO-008 Atlantic Doors and Hardware_Fully Executed 03.03.2025.pdf", "Atlantic Doors", "ATLANTIC DOORS & HARDWARE, INC."),
]

# Also look for Miller, Alphacladding, Modern Heavy, DCL
# Miller - check for executed agreement in 06 folder
for root, dirs, files in os.walk(TRADE):
    for f in files:
        if f.endswith('.pdf') and 'executed' in root.lower() or 'executed' in f.lower():
            label = root.replace(TRADE+'/', '').split('/')[0] if '/' in root.replace(TRADE+'/', '') else root.replace(TRADE+'/', '')
            if label and 'executed' in label.lower() or 'executed' in f.lower():
                full = os.path.join(root, f)
                if full not in [c[0] for c in contracts]:
                    contracts.append((full, label[:25], f[:30], os.path.getsize(full)))

print(f"TOTAL CONTRACTS FOUND: {len(contracts)}")
print()
for c in contracts:
    name = c[1][:25] if len(c) > 1 else "?"
    path = c[0]
    size = c[-1]
    print(f"  {name:25s} | {size//1024:>5}KB | {path[-80:]}")
