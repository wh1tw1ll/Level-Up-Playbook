import pymupdf, re

BASE = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal"

docs = [
    (f"{BASE}/03 - Design Team/301-303 - Design Architect/MANICA/Complete_with_DocuSign_MFP_--_Design Architect (FE).pdf", "MANICA"),
    (f"{BASE}/03 - Design Team/301-303 - Design Architect/Agreement for AOR Services (Execution Copy (FE)).pdf", "ARQ"),
    (f"{BASE}/01 - Construction Manager Agreement/Inter Miami Stadium-Lemartec -- CM as Agent Agreement FINAL - 03-31-25.pdf", "LEMARTEC CMA"),
]

for path, label in docs:
    doc = pymupdf.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    
    print(f"\n=== {label} ({doc.page_count}p) ===")
    
    # Find fee amounts - look for dollars in first 30 pages
    fees = re.findall(r"(?:fixed fee|base fee|basic services|contract sum|guaranteed maximum|GMP|total fee|contract price|amount)[^.]*(?:\$[0-9,]+(?:\.\d+)?(?: Million| Thousand|))", text[:20000])
    for f in fees[:10]:
        print(f"  FEE: {f[:200]}")
    
    # Dollar amounts near "fee" or "compensation" 
    amounts = re.findall(r"\$[0-9,]+(?:\.\d+)?(?:\s*(?:Million|Thousand|Dollars|\.00))?", text[:10000])
    for a in amounts:
        print(f"  AMOUNT: {a}")
    
    # Find additional services / ASA
    for kw in ["additional service", "ASA", "Change Order", "Additional Services Directive"]:
        for m in re.finditer(kw, text, re.IGNORECASE):
            ctx = text[max(0,m.start()-50):m.end()+150].replace('\n',' ').strip()
            if any(c.isdigit() for c in ctx[:20]):
                print(f"  [{kw}]: {ctx[:200]}")
    
    # Count ASAs / change orders
    asa_count = len([m for m in re.finditer(r"(?:Additional Services Directive|Change Order)\s+(?:No\.|#)?\s*(\d+)", text, re.IGNORECASE)])
    print(f"  ASAs mentioned: {asa_count}")
    
    doc.close()