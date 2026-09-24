#!/usr/bin/env python3
"""JCI Budget v4 — OH&P% and Fee% as separate columns per side.
JCI side: shows the actual OH&P% + Fee% JCI used per line item.
LUCI side: shows my recommended OH&P% + Fee%.
Totals show actual proven dollar figures from the existing analysis."""

import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

wb = openpyxl.Workbook()

# Styling
JCIF = PatternFill(fgColor='FCE4EC', fill_type='solid')
LUF  = PatternFill(fgColor='E8F5E9', fill_type='solid')
HDR  = PatternFill(fgColor='2D2D2D', fill_type='solid')
SEC  = PatternFill(fgColor='F0F0F0', fill_type='solid')
TJC  = PatternFill(fgColor='F8BBD0', fill_type='solid')
TLU  = PatternFill(fgColor='C8E6C9', fill_type='solid')
TOT  = PatternFill(fgColor='BBDEFB', fill_type='solid')
DHL  = PatternFill(fgColor='1565C0', fill_type='solid')
DELF = PatternFill(fgColor='E3F2FD', fill_type='solid')

tb = Border(left=Side(style='thin', color='CCCCCC'),
            right=Side(style='thin', color='CCCCCC'),
            top=Side(style='thin', color='CCCCCC'),
            bottom=Side(style='thin', color='CCCCCC'))
sb = Border(bottom=Side(style='medium', color='999999'))
dbt = Border(top=Side(style='double', color='333333'),
             bottom=Side(style='double', color='333333'),
             left=Side(style='thin', color='CCCCCC'),
             right=Side(style='thin', color='CCCCCC'))

HF = Font(name='Calibri', bold=True, size=11, color='FFFFFF')
TF = Font(name='Calibri', bold=True, size=14, color='1A1A1A')
SF = Font(name='Calibri', bold=True, size=10, color='555555')
BF = Font(name='Calibri', bold=True, size=10)
BL = Font(name='Calibri', bold=True, size=11)
DF = Font(name='Calibri', size=10)
MF = '#,##0'  # accounting format
PF = '0%'     # percentage format

COL_ITEM = 1
COL_JB, COL_JOHP, COL_JFEE, COL_JTOT = 2, 3, 4, 5
COL_SP = 6
COL_LB, COL_LOHP, COL_LFEE, COL_LTOT = 7, 8, 9, 10
COL_DELTA = 11
COL_NOTE = 12
MC = 12

def wc(ws, r, c, v, font=None, fill=None, fmt=None, align=None, border=None):
    cell = ws.cell(r, c, v)
    if font:   cell.font = font
    if fill:   cell.fill = fill
    if fmt:    cell.number_format = fmt
    if align:  cell.alignment = align
    if border: cell.border = border
    return cell

def write_row(ws, r, items, is_total=False):
    """items: list of 12 values for cols 1-12."""
    for c, v in enumerate(items, 1):
        if c == COL_SP:
            wc(ws, r, c, '', border=tb); continue
        if is_total:
            fn = BL; fl = (TJC if c <= COL_JTOT else (TLU if c <= COL_LTOT else (TOT if c == COL_DELTA else None)))
        else:
            fn = DF; fl = (JCIF if c <= COL_JTOT else (LUF if c <= COL_LTOT else (DELF if c == COL_DELTA else None)))
        fmt = (PF if c in (COL_JOHP, COL_JFEE, COL_LOHP, COL_LFEE) and isinstance(v, (int,float))
               else (MF if c in (COL_JB, COL_JTOT, COL_LB, COL_LTOT, COL_DELTA) else None))
        al = Alignment(horizontal='center') if c in (COL_JOHP, COL_JFEE, COL_LOHP, COL_LFEE) else None
        wc(ws, r, c, v, font=fn, fill=fl, fmt=fmt, align=al, border=dbt if is_total else tb)
    ws.row_dimensions[r].height = 22 if is_total else 18

def write_section(ws, r, label):
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=MC)
    wc(ws, r, 1, label, font=BF, fill=SEC)
    for c in range(1, MC+1):
        ws.cell(r, c).fill = SEC
        ws.cell(r, c).border = sb
    ws.row_dimensions[r].height = 22
    return r + 1

def compute_total(base, ohp_pct, fee_pct):
    return int(round(base * (1 + ohp_pct + fee_pct), 0))

# ── LINE ITEMS ──
# (name, jci_base, jci_ohp%, jci_fee%, jci_total_actual, luci_base, luci_ohp%, luci_fee%, note)
# jci_total_actual = the real JCI total from the original pricing (may differ from base×(1+ohp+fee))
DC = [
    ('I5 Lighting (turnkey → material-only)', 16258878, 0.12, 0.00, 18258878,
     12000000, 0.00, 0.00, 'Buy direct: i5 hw $6.2M + CM install $2.5M. Strip 12% markup.'),
    ('BMS System (pass-through sub)', 3500000, 0.00, 0.00, 3500000,
     3500000, 0.00, 0.00, 'Pass-through. Fine as-is.'),
    ('Switchgear & Elec (ROM material)', 3925000, 0.12, 0.10, 5195513,
     3925000, 0.03, 0.00, 'JCI: 12% OH&P + 10% Fee = 22%. LUCI: 3% CM handling.'),
    ('Central Utility Plant (DB modular)', 20000000, 0.12, 0.10, 26516067,
     20000000, 0.10, 0.00, 'JCI: 22% markup on modular plant. LUCI: 10% OH&P only.'),
    ('CIMCO Ice (turnkey sub)', 1767187, 0.12, 0.00, 2008168,
     1767187, 0.00, 0.00, '12% OH on sub equipment. Strip markup — pass-through.'),
    ('JCI Lighting Material (material sub)', 2343732, 0.12, 0.00, 2663332,
     2343732, 0.00, 0.00, 'Material-only pass-through. Strip 12% markup.'),
    ('Air Handlers (material sub)', 2055375, 0.12, 0.10, 2635096,
     2055375, 0.00, 0.00, '22% markup on pass-through material. Strip entirely.'),
]

SC = [
    ('Performance Bond', 249678, 0.00, 0.00, 249678, 200000, 0.00, 0.00, 'Minor trim.'),
    ('Deal Development (PRE-AWARD)', 450000, 0.00, 0.00, 450000, 0, 0.00, 0.00, 'Not construction budget.'),
    ('JCI Scope Development', 110306, 0.00, 0.00, 110306, 50000, 0.00, 0.00, 'Trim to $50K.'),
    ('GC Labor (see Sheet 4)', 3763297, 0.00, 0.00, 3763297, 2100000, 0.00, 0.00, 'Market rates.'),
    ('GC Other (2.1% → 1% of base)', 1604597, 0.00, 0.00, 1604597, 900000, 0.00, 0.00, 'Trim to 1% of base.'),
    ('Professional Services', 0, 0.00, 0.00, 0, 0, 0.00, 0.00, 'Already excluded.'),
    ('Construction Risk (11.7% → 6%)', 2550000, 0.117, 0.00, 8949879, 2550000, 0.06, 0.00,
     'Risk contingency on top of 12-22% OH&P. Reduce to 6%.'),
    ('Transition Scope (O&M bridge)', 675000, 0.00, 0.00, 675000, 200000, 0.00, 0.00, 'Trim.'),
]

# ═══════════════════════════
# SHEET 1: FULL SIDE-BY-SIDE
# ═══════════════════════════
ws = wb.active
ws.title = 'Full Side-by-Side'

ws.column_dimensions[get_column_letter(COL_ITEM)].width = 40
for c in range(2, MC+1):
    if c == COL_SP: ws.column_dimensions[get_column_letter(c)].width = 3
    elif c in (COL_JOHP, COL_JFEE, COL_LOHP, COL_LFEE): ws.column_dimensions[get_column_letter(c)].width = 9
    elif c == COL_NOTE: ws.column_dimensions[get_column_letter(c)].width = 50
    else: ws.column_dimensions[get_column_letter(c)].width = 14

# Row 1: Title
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=MC)
wc(ws, 1, 1, 'JCI BUDGET — FULL SIDE-BY-SIDE (OH&P + Fee Split by %)', TF,
   align=Alignment(horizontal='center'))
ws.row_dimensions[1].height = 28

# Row 2: Group headers
ws.merge_cells(start_row=2, start_column=COL_JB, end_row=2, end_column=COL_JTOT)
wc(ws, 2, COL_JB, 'JCI Pricing (Original)', HF, fill=HDR, align=Alignment(horizontal='center'))
for c in range(COL_JB, COL_JTOT+1): ws.cell(2, c).fill = HDR

ws.merge_cells(start_row=2, start_column=COL_LB, end_row=2, end_column=COL_LTOT)
wc(ws, 2, COL_LB, 'LUCI (Revised)', HF, fill=HDR, align=Alignment(horizontal='center'))
for c in range(COL_LB, COL_LTOT+1): ws.cell(2, c).fill = HDR

for c in (COL_ITEM, COL_SP, COL_DELTA, COL_NOTE):
    wc(ws, 2, c, '', font=HF, fill=HDR)
ws.row_dimensions[2].height = 20

# Row 3: Column headers
headers = ['Line Item', 'Base Cost', 'OH&P %', 'Fee %', 'JCI Total', '',
           'Base Cost', 'OH&P %', 'Fee %', 'LUCI Total', 'Delta', 'Strategy / Notes']
for c, h in enumerate(headers, 1):
    fl = DHL if c == COL_DELTA else HDR
    wc(ws, 3, c, h, font=HF, fill=fl, align=Alignment(horizontal='center', wrap_text=True))
ws.row_dimensions[3].height = 28

# ── DIRECT COSTS ──
r = write_section(ws, 4, 'DIRECT COSTS')

dc_jci_total = 0
dc_luci_total = 0
for item in DC:
    nm, jb, johp, jfee, jt, lb, lohp, lfee, note = item
    lt = compute_total(lb, lohp, lfee)
    delta = jt - lt
    dc_jci_total += jt
    dc_luci_total += lt
    write_row(ws, r, [nm, jb, johp, jfee, jt, '', lb, lohp, lfee, lt, delta, note])
    r += 1

dc_delta = dc_jci_total - dc_luci_total
dc_pct = dc_delta / dc_jci_total * 100
write_row(ws, r, ['DIRECT COSTS TOTAL', sum(x[1] for x in DC), '', '', dc_jci_total, '',
                   sum(x[4] for x in DC), '', '', dc_luci_total, dc_delta,
                   f'Direct cost savings: {dc_delta/dc_jci_total*100:.0f}%'], is_total=True)
r += 1

# ── SOFT COSTS ──
r = write_section(ws, r, 'SOFT COSTS / FEES')

sc_jci_total = 0
sc_luci_total = 0
for item in SC:
    nm, jb, johp, jfee, jt, lb, lohp, lfee, note = item
    lt = compute_total(lb, lohp, lfee)
    delta = jt - lt
    sc_jci_total += jt
    sc_luci_total += lt

    # Show dashes for soft cost percentage cols (no markup applies)
    johp_d = johp if johp > 0 else '—'
    jfee_d = jfee if jfee > 0 else '—'
    lohp_d = lohp if lohp > 0 else '—'
    lfee_d = lfee if lfee > 0 else '—'
    write_row(ws, r, [nm, jb, johp_d, jfee_d, jt, '', lb, lohp_d, lfee_d, lt, delta, note])
    r += 1

sc_delta = sc_jci_total - sc_luci_total
sc_pct = sc_delta / sc_jci_total * 100
write_row(ws, r, ['SOFT COSTS TOTAL', sum(x[1] for x in SC), '', '', sc_jci_total, '',
                   sum(x[4] for x in SC), '', '', sc_luci_total, sc_delta,
                   f'Soft cost savings: {sc_pct:.0f}%'], is_total=True)
r += 1

# ── PROJECT TOTAL ──
gt_jci = dc_jci_total + sc_jci_total
gt_luci = dc_luci_total + sc_luci_total
gt_sav = gt_jci - gt_luci
gt_pct = gt_sav / gt_jci * 100

jci_all_base = sum(x[1] for x in DC) + sum(x[1] for x in SC)
luci_all_base = sum(x[4] for x in DC) + sum(x[4] for x in SC)

write_row(ws, r, ['PROJECT TOTAL', jci_all_base, '', '', gt_jci, '',
                   luci_all_base, '', '', gt_luci, gt_sav,
                   f'Total savings: {gt_pct:.1f}% | ${gt_sav:,.0f} below JCI | See Strategy sheet'],
          is_total=True)


# ═══════════════════════════
# SHEET 2: SUMMARY
# ═══════════════════════════
ws2 = wb.create_sheet('Summary')
for c, w in enumerate([30, 16, 16, 16], 1):
    ws2.column_dimensions[get_column_letter(c)].width = w

wc(ws2, 1, 1, 'JCI BUDGET — TOTAL COMPARISON', TF)
wc(ws2, 2, 1, 'Dova Pricing Summary 9.14.26.xlsx — OH&P + Fee Split by %', SF)

for c, h in enumerate(['', 'JCI Total', 'LUCI Total', 'Savings'], 1):
    wc(ws2, 4, c, h, HF, fill=HDR, align=Alignment(horizontal='center'))

r2 = 5
for label, jt, lt in [('DIRECT COSTS', dc_jci_total, dc_luci_total),
                       ('SOFT COSTS / FEES', sc_jci_total, sc_luci_total)]:
    sav = jt - lt
    wc(ws2, r2, 1, label, BF, SEC, border=tb)
    wc(ws2, r2, 2, jt, BF, TJC, MF, border=tb)
    wc(ws2, r2, 3, lt, BF, TLU, MF, border=tb)
    wc(ws2, r2, 4, sav, BF, DELF, MF, border=tb)
    r2 += 1

wc(ws2, r2, 1, 'PROJECT TOTAL', BL, border=dbt)
wc(ws2, r2, 2, gt_jci, BL, TJC, MF, border=dbt)
wc(ws2, r2, 3, gt_luci, BL, TLU, MF, border=dbt)
wc(ws2, r2, 4, gt_sav, BL, TOT, MF, border=dbt)
r2 += 1
wc(ws2, r2, 4, f'{gt_pct:.1f}% savings', Font(name='Calibri', bold=True, size=10, color='1B5E20'))


# ═══════════════════════════
# SHEET 3: I5 LIGHTING DEEP DIVE
# ═══════════════════════════
ws3 = wb.create_sheet('I5 Lighting Deep Dive')
ws3.column_dimensions['A'].width = 32
for c in 'BCDEFGHIJK': ws3.column_dimensions[c].width = 14

wc(ws3, 1, 1, 'I5 LIGHTING — TURNKEY vs MATERIAL-ONLY', TF)
wc(ws3, 2, 1, 'Source: i5 quotes SQ-2601984R1, SQ-2501658R3', SF)

ws3.merge_cells('A3:E3')
wc(ws3, 3, 1, 'JCI Turnkey', HF, fill=HDR, align=Alignment(horizontal='center'))
ws3.merge_cells('F3:I3')
wc(ws3, 3, 6, 'LUCI Material-Only', HF, fill=HDR, align=Alignment(horizontal='center'))

i5_h = ['Component', 'Base', 'OH&P%', 'Fee%', 'JCI Total',
         'Base', 'OH&P%', 'Fee%', 'LUCI Total', 'Delta', 'Strategy']
for c, h in enumerate(i5_h, 1):
    wc(ws3, 4, c, h, HF, fill=HDR, align=Alignment(horizontal='center'))

i5 = [
    ('I5 Halo Hardware (SQ-2601984R1)', 6485131, 0.12, 0.00, 6485131*1.12,
     6211624, 0.00, 0.00, 'Buy direct from i5'),
    ('Install / Rigging (CM)', 2500000, 0.00, 0.12, 2800000,
     2500000, 0.00, 0.00, 'CM coordinates install. Strip JCI fee.'),
]
# Fix actual totals
i5_data = [
    ('I5 Halo Hardware (SQ-2601984R1)', 6485131, 0.12, 0.00, 7263347,
     6211624, 0.00, 0.00, 'Buy direct from i5. HW 100%.'),
    ('Install / Rigging (CM)', 2500000, 0.00, 0.12, 2800000,
     2500000, 0.00, 0.00, 'CM coordinates install. Strip JCI 12% fee.'),
]
jtot = sum(x[4] for x in i5_data)
ltot = sum(x[5] for x in i5_data)
i5_rows = [(nm, jb, johp, jfee, jt, lb, lohp, lfee, lt, note)
            for nm, jb, johp, jfee, jt, lb, lohp, lfee, note in i5_data]
i5_rows.append(('TOTAL', 8985131, None, None, jtot, 8711624, None, None, ltot, ''))

for ri, item in enumerate(i5_rows, 5):
    nm, jb, johp, jfee, jt, lb, lohp, lfee, lt, note = item
    delta = jt - lt
    is_tot = ri == 7
    for c, v in enumerate([nm, jb, johp, jfee, jt, lb, lohp, lfee, lt, delta, note], 1):
        fl = (JCIF if c <= 5 else (LUF if c <= 9 else (DELF if c == 10 else None)))
        fn = BL if is_tot else DF
        fmt = (PF if c in (3,4,7,8) and isinstance(v,(int,float))
               else (MF if c in (2,5,6,9,10) else None))
        bd = dbt if is_tot else tb
        wc(ws3, ri, c, v, font=fn, fill=fl, fmt=fmt, border=bd)


# ═══════════════════════════
# SHEET 4: GC LABOR RATE SCRUB
# ═══════════════════════════
ws4 = wb.create_sheet('GC Labor Rate Scrub')
for c, w in enumerate([28, 8, 10, 10, 8, 10, 10, 10, 40], 1):
    ws4.column_dimensions[get_column_letter(c)].width = w

wc(ws4, 1, 1, 'GC LABOR — RATE COMPARISON (Year 1)', TF)

ws4.merge_cells('B3:C3')
wc(ws4, 3, 2, 'JCI', HF, fill=HDR, align=Alignment(horizontal='center'))
ws4.merge_cells('D3:E3')
wc(ws4, 3, 4, 'LUCI (Market)', HF, fill=HDR, align=Alignment(horizontal='center'))

for c, h in enumerate(['Role', 'Hrs/Yr', 'JCI Rate', 'JCI Cost', 'Hrs/Yr', 'Market Rate', 'Market Cost', 'Delta', 'Note'], 1):
    wc(ws4, 4, c, h, HF, fill=HDR, align=Alignment(horizontal='center', wrap_text=True))

labor = [
    ('Exec Project Director', 2016, 307, 160, '92% above market'),
    ('Site Superintendent #1', 1512, 226, 135, '67% above market'),
    ('Asst Superintendent #2', 1512, 163, 110, '48% above market'),
    ('Project Manager', 2016, 173, 120, '44% above market'),
    ('Project Engineer', 2016, 130, 85, '53% above market'),
    ('Safety Manager', 1512, 141, 90, '57% above market'),
    ('Admin / Document Control', 2016, 88, 65, '35% above market'),
]
tjc = 0; tmk = 0
for ri, (role, hrs, jr, mr, note) in enumerate(labor, 5):
    jc = hrs * jr; mc = hrs * mr; delta = jc - mc
    tjc += jc; tmk += mc
    vals = [role, hrs, jr, jc, hrs, mr, mc, delta, note]
    for c, v in enumerate(vals, 1):
        fl = JCIF if c <= 4 else LUF
        if c == 1: fl = None
        fmt = MF if c in (4,7,8) else None
        wc(ws4, ri, c, v, DF, fl, fmt, border=tb)

ri = 5 + len(labor)
wc(ws4, ri, 1, 'TOTAL', BL, border=dbt)
wc(ws4, ri, 4, tjc, BL, TJC, MF, border=dbt)
wc(ws4, ri, 8, tjc - tmk, BL, border=dbt)


# ═══════════════════════════
# SHEET 5: STRATEGY SUMMARY
# ═══════════════════════════
ws5 = wb.create_sheet('Strategy Summary')
for c, w in enumerate([38, 16, 20, 55], 1):
    ws5.column_dimensions[get_column_letter(c)].width = w

wc(ws5, 1, 1, 'KEY STRATEGIC MOVES AND RECOMMENDATIONS', TF)
wc(ws5, 2, 1, 'JCI Budget Negotiation Playbook', SF)

for c, h in enumerate(['Action', 'Est. Savings', 'Markup Impact', 'Details'], 1):
    wc(ws5, 4, c, h, HF, fill=HDR, align=Alignment(horizontal='center', wrap_text=True))

strats = [
    ('1. I5 Lighting → Material-Only', '$6.3M',
     'Strip 12% JCI markup on $18.3M scope',
     'Buy i5 hardware direct ($6.2M). CM coordinates install ($2.5M). No JCI markup.'),
    ('2. Strip Markup on Pass-Through Items', '$1.8M',
     'Remove 10-22% OH&P on $10M+ equipment',
     'Air handlers, JCI lighting material, CIMCO ice — all pass-through.'),
    ('3. Normalize GC Labor Rates', '$1.7M',
     'Cut 35-92% premium above market rates',
     'JCI GC labor rates far above market ($307 vs $160 for EPD).'),
    ('4. Reduce Construction Risk Pool', '$6.0M',
     '11.7% → 6% on reduced base',
     'Risk contingency on top of 12-22% OH&P is redundant. Reduce to 6%.'),
    ('5. Trim Soft Costs', '$1.8M',
     'Eliminate non-construction items, trim overhead',
     'Deal dev ($450K), transition ($475K), GC other ($705K), dev ($60K).'),
    ('6. Target: ~$54M', f'${gt_sav:,.0f}',
     f'{gt_pct:.1f}% below JCI proposal',
     f'JCI at ${gt_jci:,.0f}. LUCI target ${gt_luci:,.0f}. Each move above line-item supported.'),
]

for ri, (act, sav, imp, det) in enumerate(strats, 5):
    wc(ws5, ri, 1, act, DF, border=tb)
    wc(ws5, ri, 2, sav, BL, align=Alignment(horizontal='center'), border=tb)
    wc(ws5, ri, 3, imp, DF, align=Alignment(wrap_text=True, vertical='top'), border=tb)
    wc(ws5, ri, 4, det, DF, align=Alignment(wrap_text=True, vertical='top'), border=tb)

# ── SAVE ──
out = r'C:\Users\HermesAdmin\JCI_Budget_Analysis_LUCI.xlsx'
wb.save(out)
print(f'Saved: {out}')
print(f'JCI Total: ${gt_jci:,.0f}  LUCI Total: ${gt_luci:,.0f}  Savings: ${gt_sav:,.0f} ({gt_pct:.1f}%)')
print(f'Sheets: {wb.sheetnames}')