import pymupdf, re, os

BASE = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/05 - Trade Contracts"

TARGETS = [
    ("01 - Baker (CIP Concrete)/Executed Subcontract/MFP-Lemartec_--_Baker_Trade_Agreement_Kc_11.6.24.pdf", "Baker Concrete"),
    ("02 - Qualico (Structural Steel)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Qualico Ste.pdf", "Qualico Steel"),
    ("04 - Right Way (Plumbing)/Executed Subcontract/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Right Way Plumbing"),
    ("05 - Hill York (Mechanical)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Hill.pdf", "Hill York"),
    ("27 - DeckTight Roofing/MFP-Lemartec -- Trade Contractor Agreement Decktight Roofing_Fully Executed 02.27.2025.pdf", "Decktight Roofing"),
    ("29 - Venur/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf", "Venur"),
]

for relpath, label in TARGETS:
    full = os.path.join(BASE, relpath)
    try:
        doc = pymupdf.open(full)
        n = doc.page_count
        
        # Find Exhibit 14 or Liquidated Damages
        e14_page = None
        for i in range(n):
            text = doc[i].get_text()
            if "EXHIBIT 14" in text or "(Liquidated Damages)" in text:
                e14_page = i
                break
        
        print(f"\n=== {label} ({n}p) ===")
        
        if e14_page is not None:
            for i in range(e14_page, min(e14_page+3, n)):
                text = doc[i].get_text()
                print(f"--- Exhibit 14 (Page {i+1}) ---")
                print(text[:1500])
        else:
            # Search last 20 pages for $ amounts near LD
            for i in range(max(0, n-20), n):
                text = doc[i].get_text()
                if re.search(r"\$[0-9,]+(?:\.\d+)?/", text):
                    ld_hits = re.findall(r"[^.]*\$[0-9,]+(?:\.\d+)?/[^.]*\.", text)
                    for hit in ld_hits:
                        print(f"  P{i+1}: {hit.strip()[:200]}")
                
                if "liquidated" in text.lower() or "retainage" in text.lower() or "10%" in text:
                    ret = re.search(r"[^.]*retainage[^.]*\.", text, re.IGNORECASE)
                    if ret:
                        print(f"  P{i+1}: {ret.group()[:200]}")
        
        doc.close()
    except Exception as e:
        print(f"ERROR {label}: {e}")