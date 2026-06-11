import pymupdf, re, os

BASE = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal"

docs = [
    (os.path.join(BASE, "03 - Design Team/301-303 - Design Architect/MANICA/Complete_with_DocuSign_MFP_--_Design Architect (FE).pdf"), "MANICA - Design Architect"),
    (os.path.join(BASE, "03 - Design Team/301-303 - Design Architect/Agreement for AOR Services (Execution Copy (FE)).pdf"), "ARQUITECTONICA - Architect of Record"),
    (os.path.join(BASE, "01 - Construction Manager Agreement/Inter Miami Stadium-Lemartec -- CM as Agent Agreement FINAL - 03-31-25.pdf"), "LEMARTEC - Construction Manager (CMA)"),
]

for path, label in docs:
    try:
        doc = pymupdf.open(path)
        n = doc.page_count
        text = ""
        for page in doc:
            text += page.get_text()
        
        print(f"\n{'='*60}")
        print(f"=== {label} ({n}p) ===")
        print(f"{'='*60}")
        
        # Parties
        for kw in ["Miami Freedom Park", "Lemartec", "Manica", "Arquitectonica", "Architect", "Construction Manager", "Owner", "Trade Contractor"]:
            positions = [m.start() for m in re.finditer(kw, text[:5000])]
            if positions:
                ctx = text[max(0,positions[0]-20):positions[0]+100].replace('\n',' ').strip()
                print(f"  {kw}: ...{ctx}...")
        
        # Contract value/fee
        fee_matches = re.findall(r"\$[0-9,]+(?:\.\d+)?(?:\s*(?:Million|Dollars|\.00))?|(?:fee|amount|price|cost|budget)[^.]*(?:\$[0-9,]+)", text[:5000], re.IGNORECASE)
        for m in fee_matches[:5]:
            print(f"  Fee: {m}")
        
        # Scope
        scope_match = re.search(r"(?:scope of work|services)[^.]{10,200}\.", text[:8000], re.IGNORECASE)
        if scope_match:
            print(f"  Scope: {scope_match.group().replace(chr(10),' ')[:200]}")
        
        # Key terms
        for kw in ["liquidated damage", "termination", "warranty", "retainage", "payment", "indemnif", "insurance", "consequential", "change order", "additional service"]:
            for m in re.finditer(kw, text, re.IGNORECASE):
                ctx = text[max(0,m.start()-30):m.end()+100].replace('\n',' ').strip()
                print(f"  [{kw}]: ...{ctx[:180]}...")
                break  # just first match
        
        doc.close()
    except Exception as e:
        print(f"ERROR {label}: {e}")