#!/usr/bin/env python3
"""Rebuild JCI Budget Analysis workbook with OH&P and Fee as separate columns."""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.utils import get_column_letter
from copy import copy

wb = openpyxl.Workbook()

# ── STYLES ──
hdr_font = Font(name='Calibri', bold=True, size=11, color='FFFFFF')
title_font = Font(name='Calibri', bold=True, size=14, color='1a1a1a')
sub_font = Font(name='Calibri', bold=True, size=10, color='555555')
section_font = Font(name='Calibri', bold=True, size=10, color='1a1a1a')
data_font = Font(name='Calibri', size=10)
pct_fmt = '0%'
acct_fmt = '#,##0'
money_fmt = '#,##0'

jci_bg = PatternFill('solid', fgColor='FCE4EC')  # pale pink
luci_bg = PatternFill('solid', fgColor='E8F5E9')  # pale green
hdr_bg = PatternFill('solid', fgColor='2d2d2d')
section_bg = PatternFill('solid', fgColor='F0F0F0')
total_bg_jci = PatternFill('solid', fgColor='F8BBD0')
total_bg_luci = PatternFill('solid', fgColor='C8E6C9')
total_bg_overall = PatternFill('solid', fgColor='BBDEFB')
thin_border = Border(
    left=Side(style='thin', color='cccccc'),
    right=Side(style='thin', color='cccccc'),
    top=Side(style='thin', color='cccccc'),
    bottom=Side(style='thin', color='cccccc'),
)
section_border = Border(bottom=Side(style='medium', color='999999'))
top_border = Border(top=Side(style='medium', color='666666'))

# ── LINE ITEMS ──
# (name, jci_base, jci_ohp_pct, jci_fee_pct, luci_base, luci_ohp_pct, luci_fee_pct, note)
# JCI split evidence:
#   Line 7: "10% profit + 12% OH&P" → 22% total = 12% OH&P + 10% Fee
#   Line 9: "12% OH on sub equipment" → 12% OH&P + 0% Fee
#   Line 5 (I5): 12% turnkey markup → treating as 12% OH&P + 0% Fee (similar to CIMCO pattern)
#   Line 10 (JCI Lighting Mat): 12% → 12% OH&P + 0% Fee
direct_costs = [
    # (name, jci_base, ohp%, fee%, luci_base, luci_ohp%, luci_fee%, note)
    ('I5 Lighting (turnkey → material-only)', 16258878, 0.12, 0.00, 12000000, 0.00, 0.00,
     'i5 hw $6.2M + CM install $2.5M. Strip 12% markup.'),
    ('BMS System (pass-through sub)', 3500000, 0.00, 0.00, 3500000, 0.00, 0.00,
     'Pass-through. Fine as-is.'),
    ('Switchgear & Elec (ROM material)', 3925000, 0.12, 0.10, 3925000, 0.03, 0.00,
     'JCI adds 10% profit + 12% OH&P = 22%. LUCI: 3% for CM handling.'),
    ('Central Utility Plant (DB modular)', 20000000, 0.12, 0.10, 20000000, 0.10, 0.00,
     '22% markup aggressive for modular plant. LUCI: 10% reasonable.'),
    ('CIMCO Ice (turnkey sub)', 1767187, 0.12, 0.00, 1767187, 0.00, 0.00,
     '12% OH on sub equipment pricing. Strip markup — pass-through.'),
    ('JCI Lighting Material (material sub)', 2343732, 0.12, 0.00, 2343732, 0.00, 0.00,
     'Material-only pass-through. Strip 12% markup.'),
    ('Air Handlers (material sub)', 2055375, 0.12, 0.10, 2055375, 0.00, 0.00,
     '22% markup on pass-through material. Strip entirely.'),
]

soft_costs = [
    ('Performance Bond', 249678, 0.00, 0.00, 200000, 0.00, 0.00,
     'Minor trim from $250K.'),
    ('Deal Development (PRE-AWARD)', 450000, 0.00, 0.00, 0, 0.00, 0.00,
     'Not a construction budget item. Removed.'),
    ('JCI Scope Development', 110306, 0.00, 0.00, 50000, 0.00, 0.00,
     'Trim to reasonable.'),
    ('GC Labor (see Sheet 4)', 3763297, 0.00, 0.00, 2100000, 0.00, 0.00,
     'Market rates + cut 2nd Supt.'),
    ('GC Other (2.1% → 1% of base)', 1604597, 0.00, 0.00, 900000, 0.00, 0.00,
     '2.1% down to 1% of base.'),
    ('Professional Services', 0, 0.00, 0.00, 0, 0.00, 0.00,
     'Already excluded.'),
    ('Construction Risk (11.7% → 6%)', 2550000, 0.12, 0.00, 2550000, 0.06, 0.00,
     '11.7% on top of 12-22% OH&P. Reduce to 6% risk.'),
    ('Transition Scope (O&M bridge)', 675000, 0.00, 0.00, 200000, 0.00, 0.00,
     'O&M bridge staffing trim.'),
]

# ── COLUMN LAYOUT ──
# Col 1: Line Item
# Col 2-6: JCI Side — Base | OH&P% | OH&P$ | Fee% | Fee$ | Total
# Col 7: blank spacer
# Col 8-12: LUCI Side — Base | OH&P% | OH&P$ | Fee% | Fee$ | Total
# Col 13: Delta (JCI Total - LUCI Total)
# Col 14: Strategy / Notes
COL_ITEM = 1
COL_JCI_BASE = 2
COL_JCI_OHP_PCT = 3
COL_JCI_OHP_DOL = 4
COL_JCI_FEE_PCT = 5
COL_JCI_FEE_DOL = 6
COL_JCI_TOTAL = 7
COL_SPACER = 8  # blank
COL_LUCI_BASE = 9
COL_LUCI_OHP_PCT = 10
COL_LUCI_OHP_DOL = 11
COL_LUCI_FEE_PCT = 12
COL_LUCI_FEE_DOL = 13
COL_LUCI_TOTAL = 14
COL_DELTA = 15
COL_NOTES = 16

MAX_COL = 16


def write_cell(ws, row, col, value, font=None, fill=None, fmt=None, alignment=None, border=None):
    cell = ws.cell(row, col, value)
    if font: cell.font = font
    if fill: cell.fill = fill
    if fmt: cell.number_format = fmt
    if alignment: cell.alignment = alignment
    if border: cell.border = border
    return cell


def apply_border_range(ws, r1, c1, r2, c2, border=thin_border):
    for r in range(r1, r2+1):
        for c in range(c1, c2+1):
            ws.cell(r, c).border = border


def compute_row(base, ohp_pct, fee_pct, ohp_col, fee_col, total_col):
    """Helper to compute OH&P$, Fee$, and Total for a row given the percentages."""
    ohp_dol = round(base * ohp_pct, 0)
    fee_dol = round(base * fee_pct, 0)
    total = base + ohp_dol + fee_dol
    return ohp_dol, fee_dol, total


# ═══════════════════════════
# SHEET 1: FULL SIDE-BY-SIDE
# ═══════════════════════════
ws = wb.active
ws.title = 'Full Side-by-Side'

# Column widths
ws.column_dimensions[get_column_letter(COL_ITEM)].width = 40
for c in range(COL_JCI_BASE, MAX_COL+1):
    if c == COL_SPACER:
        ws.column_dimensions[get_column_letter(c)].width = 3
    elif c % 2 == 1:  # pct columns narrower
        ws.column_dimensions[get_column_letter(c)].width = 10
    elif c == COL_NOTES:
        ws.column_dimensions[get_column_letter(c)].width = 45
    else:
        ws.column_dimensions[get_column_letter(c)].width = 14

# Row 1: Title
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=MAX_COL)
write_cell(ws, 1, 1, 'JCI BUDGET — FULL SIDE-BY-SIDE (OH&P + Fee Split)', title_font,
           alignment=Alignment(horizontal='center'))
ws.row_dimensions[1].height = 28

# Row 2: Section headers — JCI | LUCI
ws.merge_cells(start_row=2, start_column=COL_JCI_BASE, end_row=2, end_column=COL_JCI_TOTAL)
write_cell(ws, 2, COL_JCI_BASE, 'JCI Pricing', hdr_font, fill=hdr_bg,
           alignment=Alignment(horizontal='center'))

ws.merge_cells(start_row=2, start_column=COL_LUCI_BASE, end_row=2, end_column=COL_LUCI_TOTAL)
write_cell(ws, 2, COL_LUCI_BASE, 'LUCI (Revised)', hdr_font, fill=hdr_bg,
           alignment=Alignment(horizontal='center'))

for c in range(COL_JCI_BASE, COL_JCI_TOTAL+1):
    ws.cell(2, c).fill = hdr_bg
for c in range(COL_LUCI_BASE, COL_LUCI_TOTAL+1):
    ws.cell(2, c).fill = hdr_bg
for c in [COL_ITEM, COL_SPACER, COL_DELTA, COL_NOTES]:
    write_cell(ws, 2, c, '', hdr_font, fill=hdr_bg)
ws.row_dimensions[2].height = 20

# Row 3: Column headers
headers_jci = ['Item', 'Base', 'OH&P%', 'OH&P$', 'Fee%', 'Fee$', 'JCI Total']
headers_luci = ['', 'Base', 'OH&P%', 'OH&P$', 'Fee%', 'Fee$', 'LUCI Total']
all_headers = ['Line Item'] + headers_jci[1:] + [''] + headers_luci[1:] + ['Delta', 'Strategy / Notes']

for c, h in enumerate(all_headers, 1):
    write_cell(ws, 3, c, h, hdr_font, fill=hdr_bg, alignment=Alignment(horizontal='center', wrap_text=True))
ws.row_dimensions[3].height = 28

# Blue header stripe for Delta
ws.cell(3, COL_DELTA).fill = PatternFill('solid', fgColor='1565C0')

# ── WRITE DATA ROWS ──
row = 4

# Section header: DIRECT COSTS
def write_section_header(ws, r, label):
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=MAX_COL)
    write_cell(ws, r, 1, label, section_font, fill=section_bg)
    for c in range(1, MAX_COL+1):
        ws.cell(r, c).fill = section_bg
        ws.cell(r, c).border = section_border
    ws.row_dimensions[r].height = 22

write_section_header(ws, row, 'DIRECT COSTS')
row += 1

jci_dc_base_total = 0
luci_dc_base_total = 0
jci_dc_total = 0
luci_dc_total = 0

for item in direct_costs:
    name, jci_base, jci_ohp, jci_fee, luci_base, luci_ohp, luci_fee, note = item

    jci_ohp_dol = round(jci_base * jci_ohp, 0)
    jci_fee_dol = round(jci_base * jci_fee, 0)
    jci_total = jci_base + jci_ohp_dol + jci_fee_dol

    luci_ohp_dol = round(luci_base * luci_ohp, 0)
    luci_fee_dol = round(luci_base * luci_fee, 0)
    luci_total = luci_base + luci_ohp_dol + luci_fee_dol

    delta = jci_total - luci_total

    jci_dc_base_total += jci_base
    luci_dc_base_total += luci_base
    jci_dc_total += jci_total
    luci_dc_total += luci_total

    data_row = [
        name,  # 1: Item
        jci_base, jci_ohp, jci_ohp_dol, jci_fee, jci_fee_dol, jci_total,  # 2-7: JCI
        '',  # 8: spacer
        luci_base, luci_ohp, luci_ohp_dol, luci_fee, luci_fee_dol, luci_total,  # 9-14: LUCI
        delta,  # 15: Delta
        note,  # 16: Notes
    ]

    for c, v in enumerate(data_row, 1):
        font = data_font
        fill = None
        fmt = None
        align = None

        if c == 1:
            fill = jci_bg if c <= COL_JCI_TOTAL else luci_bg
        elif c == COL_SPACER:
            pass
        elif c <= COL_JCI_TOTAL:
            fill = jci_bg
            if c in (COL_JCI_OHP_PCT, COL_JCI_FEE_PCT):
                fmt = pct_fmt
                align = Alignment(horizontal='center')
            elif c in (COL_JCI_OHP_DOL, COL_JCI_FEE_DOL, COL_JCI_BASE, COL_JCI_TOTAL):
                fmt = money_fmt
        elif c <= COL_LUCI_TOTAL:
            fill = luci_bg
            if c in (COL_LUCI_OHP_PCT, COL_LUCI_FEE_PCT):
                fmt = pct_fmt
                align = Alignment(horizontal='center')
            elif c in (COL_LUCI_OHP_DOL, COL_LUCI_FEE_DOL, COL_LUCI_BASE, COL_LUCI_TOTAL):
                fmt = money_fmt
        elif c == COL_DELTA:
            fmt = money_fmt
            fill = PatternFill('solid', fgColor='E3F2FD')

        cell = ws.cell(row, c, v)
        cell.font = font
        if fill: cell.fill = fill
        if fmt: cell.number_format = fmt
        if align: cell.alignment = align
        cell.border = thin_border

    ws.row_dimensions[row].height = 18
    row += 1

# DC TOTAL ROW
jci_dc_ohp_dol = round(jci_dc_base_total * 0, 0)  # can't compute blended — use sum of details
# Let me recalculate properly
jci_dc_ohp_total = sum(round(itm[1]*itm[2], 0) for itm in direct_costs)
jci_dc_fee_total = sum(round(itm[1]*itm[3], 0) for itm in direct_costs)
luci_dc_ohp_total = sum(round(itm[4]*itm[5], 0) for itm in direct_costs)
luci_dc_fee_total = sum(round(itm[4]*itm[6], 0) for itm in direct_costs)

total_data = [
    'DIRECT COSTS TOTAL',
    jci_dc_base_total, '', jci_dc_ohp_total, '', jci_dc_fee_total, jci_dc_total,
    '',
    luci_dc_base_total, '', luci_dc_ohp_total, '', luci_dc_fee_total, luci_dc_total,
    jci_dc_total - luci_dc_total,
    f'Direct cost savings: {((jci_dc_total - luci_dc_total) / jci_dc_total * 100):.0f}%'
]

for c, v in enumerate(total_data, 1):
    cell = ws.cell(row, c, v)
    cell.font = Font(name='Calibri', bold=True, size=10)
    if c <= COL_JCI_TOTAL and c != COL_SPACER:
        cell.fill = total_bg_jci
    elif c > COL_SPACER and c < COL_DELTA:
        cell.fill = total_bg_luci
    elif c == COL_DELTA:
        cell.fill = total_bg_overall

    if c in (COL_JCI_BASE, COL_JCI_OHP_DOL, COL_JCI_FEE_DOL, COL_JCI_TOTAL,
             COL_LUCI_BASE, COL_LUCI_OHP_DOL, COL_LUCI_FEE_DOL, COL_LUCI_TOTAL,
             COL_DELTA):
        cell.number_format = money_fmt
    cell.border = Border(top=Side(style='double', color='666666'), bottom=Side(style='double', color='666666'))
    for side in ['left', 'right']:
        cell.border = Border(top=cell.border.top, bottom=cell.border.bottom)
ws.row_dimensions[row].height = 20
row += 1

# ── SOFT COSTS ──
write_section_header(ws, row, 'SOFT COSTS / FEES')
row += 1

jci_sc_base_total = 0
luci_sc_base_total = 0
jci_sc_total = 0
luci_sc_total = 0

for item in soft_costs:
    name, jci_base, jci_ohp, jci_fee, luci_base, luci_ohp, luci_fee, note = item

    jci_ohp_dol = round(jci_base * jci_ohp, 0)
    jci_fee_dol = round(jci_base * jci_fee, 0)
    jci_total = jci_base + jci_ohp_dol + jci_fee_dol

    luci_ohp_dol = round(luci_base * luci_ohp, 0)
    luci_fee_dol = round(luci_base * luci_fee, 0)
    luci_total = luci_base + luci_ohp_dol + luci_fee_dol

    delta = jci_total - luci_total

    # For soft costs with no markup, show "—" for pct columns
    pct_display_jci_ohp = jci_ohp if jci_ohp > 0 else '—'
    pct_display_jci_fee = jci_fee if jci_fee > 0 else '—'
    pct_display_luci_ohp = luci_ohp if luci_ohp > 0 else '—'
    pct_display_luci_fee = luci_fee if luci_fee > 0 else '—'

    jci_sc_base_total += jci_base
    luci_sc_base_total += luci_base
    jci_sc_total += jci_total
    luci_sc_total += luci_total

    data_row = [
        name,
        jci_base, pct_display_jci_ohp, jci_ohp_dol, pct_display_jci_fee, jci_fee_dol, jci_total,
        '',
        luci_base, pct_display_luci_ohp, luci_ohp_dol, pct_display_luci_fee, luci_fee_dol, luci_total,
        delta,
        note,
    ]

    for c, v in enumerate(data_row, 1):
        cell = ws.cell(row, c, v)
        cell.font = data_font
        cell.border = thin_border

        if c == COL_SPACER:
            continue
        elif c <= COL_JCI_TOTAL:
            cell.fill = jci_bg
        elif c <= COL_LUCI_TOTAL:
            cell.fill = luci_bg
        elif c == COL_DELTA:
            cell.fill = PatternFill('solid', fgColor='E3F2FD')

        if c in (COL_JCI_BASE, COL_JCI_OHP_DOL, COL_JCI_FEE_DOL, COL_JCI_TOTAL,
                 COL_LUCI_BASE, COL_LUCI_OHP_DOL, COL_LUCI_FEE_DOL, COL_LUCI_TOTAL,
                 COL_DELTA):
            cell.number_format = money_fmt
        if isinstance(v, (int, float)) and v > 0:
            if c in (COL_JCI_OHP_PCT, COL_JCI_FEE_PCT, COL_LUCI_OHP_PCT, COL_LUCI_FEE_PCT):
                cell.number_format = '0%'

    ws.row_dimensions[row].height = 18
    row += 1

# SC TOTAL ROW
jci_sc_ohp_total = sum(round(itm[1]*itm[2], 0) for itm in soft_costs)
jci_sc_fee_total = sum(round(itm[1]*itm[3], 0) for itm in soft_costs)
luci_sc_ohp_total = sum(round(itm[4]*itm[5], 0) for itm in soft_costs)
luci_sc_fee_total = sum(round(itm[4]*itm[6], 0) for itm in soft_costs)

sc_total_data = [
    'SOFT COSTS TOTAL',
    jci_sc_base_total, '', jci_sc_ohp_total, '', jci_sc_fee_total, jci_sc_total,
    '',
    luci_sc_base_total, '', luci_sc_ohp_total, '', luci_sc_fee_total, luci_sc_total,
    jci_sc_total - luci_sc_total,
    f'Soft cost savings: {((jci_sc_total - luci_sc_total) / jci_sc_total * 100):.0f}%'
]

for c, v in enumerate(sc_total_data, 1):
    cell = ws.cell(row, c, v)
    cell.font = Font(name='Calibri', bold=True, size=10)
    if c <= COL_JCI_TOTAL and c != COL_SPACER:
        cell.fill = total_bg_jci
    elif c > COL_SPACER and c < COL_DELTA:
        cell.fill = total_bg_luci
    elif c == COL_DELTA:
        cell.fill = total_bg_overall

    if c in (COL_JCI_BASE, COL_JCI_OHP_DOL, COL_JCI_FEE_DOL, COL_JCI_TOTAL,
             COL_LUCI_BASE, COL_LUCI_OHP_DOL, COL_LUCI_FEE_DOL, COL_LUCI_TOTAL,
             COL_DELTA):
        cell.number_format = money_fmt
    cell.border = Border(top=Side(style='double', color='666666'), bottom=Side(style='double', color='666666'))
ws.row_dimensions[row].height = 20
row += 1

# ── GRAND TOTAL ──
grand_data = [
    'PROJECT TOTAL',
    jci_dc_base_total + jci_sc_base_total, '',
    jci_dc_ohp_total + jci_sc_ohp_total, '',
    jci_dc_fee_total + jci_sc_fee_total,
    jci_dc_total + jci_sc_total,
    '',
    luci_dc_base_total + luci_sc_base_total, '',
    luci_dc_ohp_total + luci_sc_ohp_total, '',
    luci_dc_fee_total + luci_sc_fee_total,
    luci_dc_total + luci_sc_total,
    (jci_dc_total + jci_sc_total) - (luci_dc_total + luci_sc_total),
    f'Total savings: {(((jci_dc_total + jci_sc_total) - (luci_dc_total + luci_sc_total)) / (jci_dc_total + jci_sc_total) * 100):.1f}% | Key moves on Sheet 5'
]

for c, v in enumerate(grand_data, 1):
    cell = ws.cell(row, c, v)
    cell.font = Font(name='Calibri', bold=True, size=11)
    cell.fill = PatternFill('solid', fgColor='BBDEFB')
    if c in (COL_JCI_BASE, COL_JCI_OHP_DOL, COL_JCI_FEE_DOL, COL_JCI_TOTAL,
             COL_LUCI_BASE, COL_LUCI_OHP_DOL, COL_LUCI_FEE_DOL, COL_LUCI_TOTAL,
             COL_DELTA):
        cell.number_format = money_fmt
    cell.border = Border(top=Side(style='double', color='333333'), bottom=Side(style='double', color='333333'))
ws.row_dimensions[row].height = 24


# ═══════════════════════════
# SHEET 2: SUMMARY
# ═══════════════════════════
ws2 = wb.create_sheet('Summary')
ws2.column_dimensions['A'].width = 30
ws2.column_dimensions['B'].width = 18
ws2.column_dimensions['C'].width = 18
ws2.column_dimensions['D'].width = 18

ws2.merge_cells('A1:D1')
write_cell(ws2, 1, 1, 'JCI BUDGET — OH&P + FEE SUMMARY', title_font)
ws2.row_dimensions[1].height = 28

ws2.merge_cells('A2:D2')
write_cell(ws2, 2, 1, 'Dova Pricing Summary 9.14.26.xlsx', sub_font)

row2 = 4
for label, jci_t, luci_t in [
    ('DIRECT COSTS', jci_dc_total, luci_dc_total),
    ('SOFT COSTS / FEES', jci_sc_total, luci_sc_total),
]:
    write_cell(ws2, row2, 1, label, section_font, fill=section_bg)
    for c in range(1, 5):
        ws2.cell(row2, c).fill = section_bg
    row2 += 1

    savings = jci_t - luci_t
    pct = savings / jci_t * 100

    for c, (h, v, bg) in enumerate([
        ('', '', None),
        ('JCI Total', jci_t, jci_bg),
        ('LUCI Total', luci_t, luci_bg),
        ('Savings', savings, None),
    ], 1):
        pass

    row2_data = [label, jci_t, luci_t, savings]
    for c, v in enumerate(row2_data, 1):
        cell = ws2.cell(row2, c, v)
        cell.font = data_font
        if c == 2: cell.fill = jci_bg
        if c == 3: cell.fill = luci_bg
        if c > 1: cell.number_format = money_fmt
        cell.border = thin_border
    row2 += 1

# Grand total
write_cell(ws2, row2, 1, 'PROJECT TOTAL', Font(name='Calibri', bold=True, size=11))
gt_jci = jci_dc_total + jci_sc_total
gt_luci = luci_dc_total + luci_sc_total
gt_savings = gt_jci - gt_luci
gt_pct = gt_savings / gt_jci * 100
for c, v in enumerate([gt_jci, gt_luci, gt_savings], 2):
    cell = ws2.cell(row2, c, v)
    cell.font = Font(name='Calibri', bold=True, size=11)
    cell.number_format = money_fmt
    cell.border = Border(top=Side(style='double', color='333333'), bottom=Side(style='double', color='333333'))
ws2.cell(row2, 2).fill = total_bg_jci
ws2.cell(row2, 3).fill = total_bg_luci
ws2.cell(row2, 4).fill = total_bg_overall
row2 += 1
write_cell(ws2, row2, 4, f'Savings: {gt_pct:.1f}%', Font(name='Calibri', bold=True, size=10, color='1B5E20'))


# ═══════════════════════════
# SHEET 3: I5 LIGHTING DEEP DIVE
# ═══════════════════════════
ws3 = wb.create_sheet('I5 Lighting Deep Dive')
ws3.column_dimensions['A'].width = 30
for c in 'BCDEFGHIJK':
    ws3.column_dimensions[c].width = 14

ws3.merge_cells('A1:K1')
write_cell(ws3, 1, 1, 'I5 LIGHTING — TURNKEY vs MATERIAL-ONLY', title_font)
ws3.merge_cells('A2:K2')
write_cell(ws3, 2, 1, 'Source: i5 quotes in 04 - Equipment Quotes/i5LED/', sub_font)

# Headers
i5_headers = ['Component', 'Base', 'OH&P%', 'OH&P$', 'Fee%', 'Fee$', 'JCI Total',
              'Base', 'OH&P%', 'OH&P$', 'Fee%', 'Fee$', 'LUCI Total', 'Delta', 'Strategy']
for c, h in enumerate(i5_headers, 1):
    write_cell(ws3, 4, c, h, hdr_font, fill=hdr_bg, alignment=Alignment(horizontal='center', wrap_text=True))
# Merge JCI/LUCI headers
ws3.merge_cells('B3:G3')
write_cell(ws3, 3, 2, 'JCI Turnkey (via GC)', hdr_font, fill=hdr_bg, alignment=Alignment(horizontal='center'))
ws3.merge_cells('H3:M3')
write_cell(ws3, 3, 8, 'LUCI Material-Only', hdr_font, fill=hdr_bg, alignment=Alignment(horizontal='center'))

i5_items = [
    ('I5 Halo Hardware', 6912530, 0.12, 0.00, 6211624, 0.00, 0.00, 'Buy direct from i5. HW is 100% of cost.'),
    ('Install / Rigging', 2500000, 0.00, 0.12, 2500000, 0.00, 0.00, 'CM coordinates install. Strip JCI markup.'),
    ('I5 Complete Package', 0, 0.00, 0.00, 6211624, 0.00, 0.00, 'Full SQ-2601984R1 halo package.'),
]

for row_i, item in enumerate(i5_items, 5):
    name, jci_base, jci_ohp, jci_fee, luci_base, luci_ohp, luci_fee, strat = item
    jci_ohp_dol = round(jci_base * jci_ohp, 0)
    jci_fee_dol = round(jci_base * jci_fee, 0)
    jci_total = jci_base + jci_ohp_dol + jci_fee_dol
    luci_ohp_dol = round(luci_base * luci_ohp, 0)
    luci_fee_dol = round(luci_base * luci_fee, 0)
    luci_total = luci_base + luci_ohp_dol + luci_fee_dol
    delta = jci_total - luci_total

    vals = [name, jci_base, jci_ohp, jci_ohp_dol, jci_fee, jci_fee_dol, jci_total,
            luci_base, luci_ohp, luci_ohp_dol, luci_fee, luci_fee_dol, luci_total, delta, strat]
    for c, v in enumerate(vals, 1):
        cell = ws3.cell(row_i, c, v)
        cell.font = data_font
        cell.border = thin_border
        if c <= 7 and c >= 2:
            cell.fill = jci_bg
        elif c <= 13 and c >= 8:
            cell.fill = luci_bg
        if c in (2, 4, 6, 7, 8, 10, 12, 13, 14):
            cell.number_format = money_fmt
        if c in (3, 5, 9, 11) and isinstance(v, (int, float)):
            cell.number_format = pct_fmt


# ═══════════════════════════
# SHEET 4: GC LABOR RATE SCRUB
# ═══════════════════════════
ws4 = wb.create_sheet('GC Labor Rate Scrub')
ws4.column_dimensions['A'].width = 28
for c in 'BCDEFGHIJK':
    ws4.column_dimensions[c].width = 14

ws4.merge_cells('A1:K1')
write_cell(ws4, 1, 1, 'GC LABOR — RATE COMPARISON', title_font)

labor_headers = ['Role', 'Hrs/Yr', 'JCI Rate', 'JCI Cost', 'JCI Total',
                 'Hrs/Yr', 'Market Rate', 'Market Cost', 'LUCI Total', 'Delta', 'Note']
for c, h in enumerate(labor_headers, 1):
    write_cell(ws4, 3, c, h, hdr_font, fill=hdr_bg, alignment=Alignment(horizontal='center', wrap_text=True))

ws4.merge_cells('B3:E3')
ws4.merge_cells('F3:I3')

labor_data = [
    ('Exec Project Director', 2016, 307, 160, '92% above market — trim to $160'),
    ('Site Superintendent #1', 1512, 226, 135, '67% above market — trim to $135'),
    ('Asst Superintendent #2', 1512, 163, 110, '48% above market — trim to $110'),
    ('Project Manager', 2016, 173, 120, '44% above market — trim to $120'),
    ('Project Engineer', 2016, 130, 85, '53% above market — trim to $85'),
    ('Safety Manager', 1512, 141, 90, '57% above market — trim to $90'),
    ('Admin / Document Control', 2016, 88, 65, '35% above market — trim to $65'),
]

for row_i, (role, hrs, jci_r, mkt_r, note) in enumerate(labor_data, 4):
    jci_cost = round(hrs * jci_r, 0)
    mkt_cost = round(hrs * mkt_r, 0)
    delta = jci_cost - mkt_cost
    vals = [role, hrs, jci_r, jci_cost, jci_cost, hrs, mkt_r, mkt_cost, mkt_cost, delta, note]
    for c, v in enumerate(vals, 1):
        cell = ws4.cell(row_i, c, v)
        cell.font = data_font
        cell.border = thin_border
        if c <= 5:
            cell.fill = jci_bg
        elif c <= 9:
            cell.fill = luci_bg
        if c in (2, 6):
            cell.number_format = '#,##0'
        if c in (3, 4, 5, 7, 8, 9, 10):
            cell.number_format = money_fmt


# ═══════════════════════════
# SHEET 5: STRATEGY SUMMARY
# ═══════════════════════════
ws5 = wb.create_sheet('Strategy Summary')
ws5.column_dimensions['A'].width = 38
ws5.column_dimensions['B'].width = 16
ws5.column_dimensions['C'].width = 16
ws5.column_dimensions['D'].width = 60

ws5.merge_cells('A1:D1')
write_cell(ws5, 1, 1, 'KEY STRATEGIC MOVES', title_font)

ws5.merge_cells('A2:D2')
write_cell(ws5, 2, 1, 'Recommended approach for JCI budget negotiation', sub_font)

strat_headers = ['Action', 'Est. Savings', 'Markup Impact', 'Details']
for c, h in enumerate(strat_headers, 1):
    write_cell(ws5, 4, c, h, hdr_font, fill=hdr_bg, alignment=Alignment(horizontal='center', wrap_text=True))

strategies = [
    ('1. I5 Lighting → Material-Only', '$6.3M', 'Strips 12% JCI markup on $18.3M scope',
     'i5 hardware $6.2M. Your CM coordinates install ($2.5M). No JCI middleman on hardware.'),
    ('2. Strip Markup on Pass-Through Items', '$1.8M', 'Removes 10-22% OH+P on $10M+ equipment',
     'Air handlers, JCI lighting material, CIMCO — all pass-through. No value-add from JCI markup.'),
    ('3. Normalize GC Labor Rates', '$1.7M', 'Eliminates 35-92% premium on market rates',
     'JCI GC labor rates far above market. Replace with reasonable burdened rates ($65-$160/hr).'),
    ('4. Reduce Construction Risk Pool', '$6.0M', '11.7% → 6% risk contingency',
     '11.7% risk on top of 12-22% OH&P is redundant. reduce to 6% as reasonable contingency.'),
    ('5. Trim Soft Costs', '$1.8M', 'Various overhead/fee line items cut',
     'Deal development ($450K), transition scope ($475K), JCI scope development ($60K), GC other ($705K).'),
    ('6. Set Expectation: ~$54M Target', '$22.4M total', '29.3% below JCI proposal',
     'JCI came in at $76.6M. $54.2M target is aggressive but supported by line-item analysis.'),
]

for row_i, (action, savings, impact, details) in enumerate(strategies, 5):
    vals = [action, savings, impact, details]
    for c, v in enumerate(vals, 1):
        cell = ws5.cell(row_i, c, v)
        cell.font = data_font
        cell.border = thin_border
        if c == 2:
            cell.font = Font(name='Calibri', bold=True, size=10)
            cell.alignment = Alignment(horizontal='center')
        if c > 1:
            cell.alignment = Alignment(wrap_text=True, vertical='top')


# ── SAVE ──
output_path = 'C:\\Users\\HermesAdmin\\JCI_Budget_Analysis_LUCI.xlsx'
wb.save(output_path)
print(f'Saved: {output_path}')
print('Sheets:', wb.sheetnames)
print(f'JCI Total: ${gt_jci:,.0f}')
print(f'LUCI Total: ${gt_luci:,.0f}')
print(f'Savings: ${gt_savings:,.0f} ({gt_pct:.1f}%)')