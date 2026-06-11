import pymupdf, re

BASE = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/05 - Trade Contracts"

files = [
    (BASE + "/23 - DCL (LED Video Boards + Signage In Bowl)/MFP-Lemartec -- CM as Agent Agreement (Trade Contractor Agreement) FINAL 1.13.25.pdf", "DCL"),
    (BASE + "/24 - Alphacladding (Exterior Glazing)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Alphacladding LLC 02.18.2025.pdf", "Alphacladding"),
]

for path, label in files:
    try:
        doc = pymupdf.open(path)
        n = doc.page_count
        text = ""
        for page in doc:
            text += page.get_text()
        
        print(f"\n=== {label} ({n}p) ===")
        
        # Scope and amount from Exhibit 1
        scope = re.search(r"Scope of Work:\s*([^\n]+)", text[:5000])
        if scope: print(f"  Scope: {scope.group(1).strip()}")
        
        amt = re.search(r"\$[0-9,]+(?:\.\d+)?(?:\s*\([\"\u201c]?[A-Za-z])", text[:5000])
        if amt: print(f"  Amount indicated: {amt.group()}")
        
        amt2 = re.search(r"(?:Million|Thousand|Hundred)[^.]*\$(?:[0-9,]+(?:\.\d+)?)", text[:5000], re.IGNORECASE)
        if amt2: print(f"  Amount text: {amt2.group()}")
        
        ret = re.search(r"retainage[^.]*(?:\d+%|________)", text[:10000], re.IGNORECASE)
        if ret: print(f"  Retainage: {ret.group().replace(chr(10),' ').strip()}")
        
        for i in range(n):
            p = doc[i].get_text()
            if "EXHIBIT 14" in p or "(Liquidated Damages)" in p:
                print(f"  Exhibit 14 at page {i+1}")
                print(f"  {p[:1200]}")
                break
        else:
            print(f"  No Exhibit 14 found")
        
        doc.close()
    except Exception as e:
        print(f"ERROR {label}: {e}")
