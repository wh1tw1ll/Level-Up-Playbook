import pymupdf, re

base = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/05 - Trade Contracts/"

targets = [
    ("04 - Right Way (Plumbing)/Executed Subcontract/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Right Way Plumbing"),
    ("05 - Hill York (Mechanical)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Hill.pdf", "Hill York"),
    ("24 - Alphacladding (Exterior Glazing)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Alphacladding LLC 02.18.2025.pdf", "Alphacladding"),
    ("27 - DeckTight Roofing/MFP-Lemartec -- Trade Contractor Agreement Decktight Roofing_Fully Executed 02.27.2025.pdf", "Decktight Roofing"),
    ("28 - Atlantic Doors/19069-PO-008 Atlantic Doors and Hardware_Fully Executed 03.03.2025.pdf", "Atlantic Doors"),
    ("29 - Venur/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Venur"),
]

for path, label in targets:
    try:
        full = base + path
        doc = pymupdf.open(full)
        text = ""
        for page in doc:
            text += page.get_text()
        
        # Search for retainage
        ret_match = re.search(r"retain[a-z]*\s+(?:in the amount of|of)\s+([0-9]+%)", text, re.IGNORECASE)
        ret_text = ret_match.group(1) if ret_match else "NOT FOUND"
        
        # Search for LD section
        ld_sec = re.search(r"liquidated damage[^.]*", text, re.IGNORECASE)
        ld_text = ld_sec.group(0)[:200] if ld_sec else "NOT FOUND"
        
        # Search for $/day amounts
        ld_rates = re.findall(r"\$[0-9,]+(?:\s*/\s*(?:calendar day|day))", text)
        
        # Search for cap
        ld_cap = re.search(r"shall not exceed\s+([^.]*)", text, re.IGNORECASE)
        cap_text = ld_cap.group(1)[:100] if ld_cap else ""
        
        print(f"=== {label} ({doc.page_count}p) ===")
        print(f"  Retainage: {ret_text}")
        if ld_rates:
            print(f"  LD rates: {ld_rates}")
        if ld_text != "NOT FOUND":
            print(f"  LD found: ...{ld_text[:150]}...")
        if cap_text:
            print(f"  Cap: {cap_text[:100]}")
        
        # Check for Exhibit 14 (LD)
        if "EXHIBIT 14" in text[:3000]:
            print(f"  Has Exhibit 14 (LD exhibit)")
        
        print()
        doc.close()
    except Exception as e:
        print(f"ERROR {label}: {e}")