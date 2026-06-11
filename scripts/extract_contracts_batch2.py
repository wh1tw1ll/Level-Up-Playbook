import pymupdf, os, re

base = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/05 - Trade Contracts"

terms = ['liquidated damage', 'warranty', 'retainage', 'payment', 'termination', 'insurance', 'scope of work', 'consequential damage', 'delay damages', 'incentive', 'bonus', 'grace period', 'cap', 'limitation of liability', 'indemnif']

agreements = [
    (os.path.join(base, "03 - Metromont (Precast)/Executed Subcontract/MFP-Lemartec Trade Contractor Agreement Met.pdf"), "Metromont LLC (SC-003)"),
    (os.path.join(base, "04 - Right Way (Plumbing)/Executed Subcontract/Lemartec_-_19069_Miami_Freedom_Park_Trade_Agr.pdf"), "Right Way Plumbing (SC-004)"),
    (os.path.join(base, "05 - Hill York (Mechanical)/Executed Subcontract/MFP-Lemartec -- Trade Contractor Agreement Hill.pdf"), "Hill York Service Company (SC-005)"),
]

for path, label in agreements:
    try:
        doc = pymupdf.open(path)
        print(f'\n{"="*60}')
        print(f'=== {label} === ({doc.page_count} pages)')
        print(f'{"="*60}')
        
        # Search each page for key terms
        for i, page in enumerate(doc):
            text = page.get_text()
            for kw in terms:
                for m in re.finditer(kw, text, re.IGNORECASE):
                    start = max(0, m.start()-60)
                    end = min(len(text), m.end()+180)
                    ctx = text[start:end].replace('\n',' ').strip()
                    print(f'  P{i+1} [{kw}]: ...{ctx[:220]}...')
        
        # Full LD context on pages that mention it
        for i, page in enumerate(doc):
            text = page.get_text()
            if 'liquidated damage' in text.lower():
                print(f'\n--- FULL LD PAGE (Page {i+1}) ---')
                print(text[:2500])
        
        doc.close()
    except Exception as e:
        print(f'ERROR {label}: {e}')
