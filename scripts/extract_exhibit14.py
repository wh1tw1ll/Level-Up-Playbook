import pymupdf, re, os

base = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/05 - Trade Contracts"

# Find all executed subcontracts (the main agreement PDFs)
# Focus on Exhibit 14 which contains the actual LD rates
targets = [
    ("01 - Baker (CIP Concrete)/Executed Subcontract/MFP-Lemartec -- CM as Agent Agreement (Trade Contractor Agreement) FINAL 10.28.24.pdf", "Baker Concrete"),
    ("02 - Qualico (Structural Steel)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Qualico Ste.pdf", "Qualico Steel"),
    ("03 - Metromont (Precast)/Executed Subcontract/MFP-Lemartec Trade Contractor Agreement Met.pdf", "Metromont"),
    ("04 - Right Way (Plumbing)/Executed Subcontract/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Right Way Plumbing"),
    ("05 - Hill York (Mechanical)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Hill.pdf", "Hill York"),
    ("06 - Miller Electric (Electric)/Summary of MECO Comments on Miami_Freedom_Park_Trade_Agreement 3.21.25_negotiated comments 20250331.pdf", "Miller Electric"),
    ("27 - DeckTight Roofing/MFP-Lemartec -- Trade Contractor Agreement Decktight Roofing_Fully Executed 02.27.2025.pdf", "Decktight Roofing"),
    ("28 - Atlantic Doors/19069-PO-008 Atlantic Doors and Hardware_Fully Executed 03.03.2025.pdf", "Atlantic Doors"),
    ("29 - Venur/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Venur"),
    ("23 - DCL (LED Video Boards + Signage In Bowl)/MFP-Lemartec -- CM as Agent Agreement (Trade Contractor Agreement) FINAL 1.13.25.pdf", "DCL (LED/Signage)"),
    ("24 - Alphacladding (Exterior Glazing)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Alphacladding LLC 02.18.2025.pdf", "Alphacladding"),
]

for relpath, label in targets:
    full = os.path.join(base, relpath)
    try:
        doc = pymupdf.open(full)
        n = doc.page_count
        
        # Extract last 3 pages (usually Exhibit 14 is near the end)
        last_text = ""
        for i in range(max(0, n-4), n):
            last_text += doc[i].get_text()
        
        print(f"\n=== {label} ({n}p) ===")
        
        # Check if Exhibit 14 exists
        if "EXHIBIT 14" in last_text or "Liquidated Damages" in last_text:
            # Find the exhibit page
            e14_start = None
            for i in range(n):
                p_text = doc[i].get_text()
                if "EXHIBIT 14" in p_text or "Liquidated Damages" in p_text:
                    e14_start = i
                    break
            
            if e14_start is not None:
                # Print page content
                for i in range(e14_start, min(e14_start+3, n)):
                    print(f"  --- Page {i+1} ---")
                    print(doc[i].get_text()[:1200])
        else:
            # Search entire document for $/day or cap
            all_text = ""
            for page in doc:
                all_text += page.get_text()
            
            dollar_per_day = re.findall(r"\$[0-9,]+(?:\.\d+)?(?:\s*/\s*(?:calendar day|day))", all_text)
            caps = re.findall(r"(?:cap|maximum|shall not exceed)[^.]*(?:\$[0-9,%]+|days)", all_text, re.IGNORECASE)
            
            if dollar_per_day:
                print(f"  LD rates (non-exhibit): {dollar_per_day}")
            if caps:
                print(f"  Caps found: {[c[:100] for c in caps[:3]]}")
            else:
                print(f"  No LD exhibit found. Searching for LD text...")
                ld_loc = all_text.lower().find("liquidated damage")
                if ld_loc >= 0:
                    print(f"  LD mentioned at char {ld_loc}")
                    print(all_text[max(0,ld_loc-50):ld_loc+300])
                else:
                    print(f"  No LD clause found in document")
        
        # Also search for retainage in the whole doc
        ret_matches = re.findall(r"(?:retainage|retain)[^.]*(?:percent|%|amount)[^.]*", all_text, re.IGNORECASE)
        if ret_matches:
            print(f"  Retainage: {ret_matches[0][:120]}")
        
        doc.close()
    except Exception as e:
        print(f"ERROR {label}: {e}")