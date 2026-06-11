import pymupdf, re

# MANICA - find fixed fee
path = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/03 - Design Team/301-303 - Design Architect/MANICA/Complete_with_DocuSign_MFP_--_Design Architect (FE).pdf"
doc = pymupdf.open(path)
text = ""
for page in doc:
    text += page.get_text()

print("=== MANICA FEE ===")
# Search for fee/compensation amounts
for kw in ["fixed fee", "base fee", "basic services", "Five Million", "$5,", "compensation", "Seven.", "Section 7."]:
    for m in re.finditer(kw, text, re.IGNORECASE):
        ctx = text[max(0,m.start()-50):m.end()+200].replace('\n',' ').strip()
        if any(c.isdigit() for c in ctx) or "Million" in ctx or "Dollar" in ctx:
            print(f"  [{kw}]: {ctx[:250]}")
doc.close()

print()

# ARQ - find fixed fee
path = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/03 - Design Team/301-303 - Design Architect/Agreement for AOR Services (Execution Copy (FE)).pdf"
doc = pymupdf.open(path)
text = ""
for page in doc:
    text += page.get_text()

print("=== ARQUITECTONICA (AOR) FEE ===")
for kw in ["fixed fee", "base fee", "basic services", "Six Million", "$6,", "compensation", "Seven.", "Section 7."]:
    for m in re.finditer(kw, text, re.IGNORECASE):
        ctx = text[max(0,m.start()-50):m.end()+200].replace('\n',' ').strip()
        if any(c.isdigit() for c in ctx) or "Million" in ctx or "Dollar" in ctx:
            print(f"  [{kw}]: {ctx[:250]}")
doc.close()

print()

# CMA - find fee
path = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/01 - Construction Manager Agreement/Inter Miami Stadium-Lemartec -- CM as Agent Agreement FINAL - 03-31-25.pdf"
doc = pymupdf.open(path)
text = ""
for page in doc:
    text += page.get_text()

print("=== LEMARTEC (CMA) FEE ===")
for kw in ["CM Fee", "Construction Manager Fee", "fixed fee", "base fee", "compensation", "Eight Million", "fee amount", "General Conditions", "GMP"]:
    for m in re.finditer(kw, text, re.IGNORECASE):
        ctx = text[max(0,m.start()-30):m.end()+200].replace('\n',' ').strip()
        if any(c.isdigit() for c in ctx) or "Million" in ctx or "Dollar" in ctx or "%" in ctx:
            print(f"  [{kw}]: {ctx[:250]}")
doc.close()