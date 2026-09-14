#!/usr/bin/env python3
"""Merge Contract Log columns into Buyout Matrix tab — correct version.
Maps by individual contract number (P-01, P-02, etc.), not by BP package."""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import column_index_from_string

SRC = r'C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents\00 - LUNA Output\02 - DOVA Arena\DOVA_Buyout_Matrix_Contract_Log.xlsx'
DST = r'C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents\00 - LUNA Output\02 - DOVA Arena\DOVA_Buyout_Matrix.xlsx'

# ── Styles ──
HDR_FONT = Font(bold=True, color='FFFFFF', size=10)
HDR_FILL = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
SEC_FONT = Font(bold=True, color='1F4E79', size=11)
SEC_FILL = PatternFill(start_color='D6E4F0', end_color='D6E4F0', fill_type='solid')
GOLD_FILL = PatternFill(start_color='FFF8E1', end_color='FFF8E1', fill_type='solid')
GREEN_FILL = PatternFill(start_color='E8F5E9', end_color='E8F5E9', fill_type='solid')
THIN = Border(
    left=Side('thin','D0D0D0'), right=Side('thin','D0D0D0'),
    top=Side('thin','D0D0D0'), bottom=Side('thin','D0D0D0'))
WRAP = Alignment(wrap_text=True, vertical='top')
CENTER = Alignment(horizontal='center', vertical='top')

# ── Load ──
wb = openpyxl.load_workbook(SRC)

# ── Read Contract Log, keyed by contract # (col D) ──
ws_cl = wb['Contract Log']
cl_by_cn = {}
for row in ws_cl.iter_rows(min_row=5, max_row=ws_cl.max_row):
    vals = {c.column_letter: c.value for c in row if c.value is not None}
    cn = str(vals.get('D', '') or '').strip()
    if cn:
        cl_by_cn[cn] = vals

# ── Exact mapping: scope name (lowered) → contract number ──
SCOPE_TO_CN = {
    'structural steel — supply & erection': 'P-01',
    'concrete — self perform': 'P-02',
    'reinforcing & pt': None,
    'mechanical (hvac) — db': 'P-03',
    'plumbing — db': 'P-04',
    'electrical — db': 'P-05',
    'fire protection — db': 'P-06',
    'elevators / escalators': 'P-07',
    'metal decking': 'P-09',
    'earthwork / site prep': 'P-08',
    'precast concrete (sps)': 'P-10',
    'glazing / glass & glazing': 'P-11',
    'roofing': 'P-12',
    'metal panels': 'P-13',
    'sheet metal & flashing': None,
    'waterproofing / dampproofing': None,
    'fireproofing': None,
    'stucco / eifs': None,
    'overhead doors & grilles': None,
    'joint sealants': None,
    'civil / sitework (outside mccarthy)': None,
    'doors, frames & hardware': None,
    'metal studs & drywall (sp)': 'P-14',
    'acoustical ceilings & walls': None,
    'tile': None,
    'communications / it': 'P-15',
    'security': 'P-16',
    'fixed seating (irwin)': 'P-17',
    'turf / furniture / nba seating': 'P-20',
    'finish carpentry / casework': None,
    'carpet & resilient flooring': None,
    'special flooring (wood/athletic)': None,
    'painting & wallcovering': None,
    'signage': 'P-19',
    'food service equipment': 'P-18',
    'loading dock equipment': None,
    'lockers': None,
    'misc specialties': None,
    'toilet partitions & accessories': None,
    'athletic equipment': None,
    'interior glass': None,
    'misc metals / stairs / railings': None,
    'ice ready infrastructure': None,
    'led / media mesh / halo': None,
    'ahl provisions': None,
    'exterior leds': None,
    'central plant / cup (jci)': 'L-05',
    'site & plaza development': None,
}

# ── New columns (L through U) ──
NEW_HEADERS = [
    ('Contract #', 10),
    ('Vendor / Subcontractor', 30),
    ('Procurement Status', 14),
    ('LOI / LNTP Date', 13),
    ('Contract Date', 13),
    ('Pending Amount', 15),
    ('Final Award Date', 13),
    ('Award Amount', 15),
    ('Approved COs', 13),
    ('Awarded Value', 15),
]
NEW_COLS = ['L','M','N','O','P','Q','R','S','T','U']
NEXT_COL = 'V'  # for future additions

# ── Write headers in row 4 ──
ws = wb['Buyout Matrix']
for i, (hdr, w) in enumerate(NEW_HEADERS):
    c = ws[f'{NEW_COLS[i]}4']
    c.value = hdr
    c.font = HDR_FONT
    c.fill = HDR_FILL
    c.alignment = CENTER
    c.border = THIN
    ws.column_dimensions[NEW_COLS[i]].width = w

# ── Helper ──
def get_cl(scope_name):
    if not scope_name:
        return None
    key = scope_name.strip().lower()
    cn = SCOPE_TO_CN.get(key)
    if cn and cn in cl_by_cn:
        return cl_by_cn[cn]
    return None

# ── Fill main data rows ──
for row_num in range(5, ws.max_row + 1):
    scope = ws[f'B{row_num}'].value
    bp_col = ws[f'A{row_num}'].value

    # Section header row
    if bp_col and not scope:
        for col in NEW_COLS:
            ws[f'{col}{row_num}'].fill = SEC_FILL
            ws[f'{col}{row_num}'].border = THIN
        continue
    if not scope:
        continue

    # OPOI section header
    scope_lower = str(scope).strip().lower()
    if scope_lower == 'scopes already outside mccarthy number':
        for col in NEW_COLS:
            ws[f'{col}{row_num}'].fill = GOLD_FILL
            ws[f'{col}{row_num}'].border = THIN
        continue

    cl = get_cl(scope)

    def get_v(v):
        if v in cl_by_cn:
            return cl_by_cn[v].get('D','')
        return ''

    if cl:
        ws[f'L{row_num}'].value = cl.get('D','')
        ws[f'M{row_num}'].value = cl.get('E','')
        ws[f'N{row_num}'].value = cl.get('A','')
        ws[f'O{row_num}'].value = cl.get('B','')
        ws[f'P{row_num}'].value = cl.get('C','')
        ws[f'Q{row_num}'].value = cl.get('G','')
        ws[f'R{row_num}'].value = cl.get('H','')
        ws[f'S{row_num}'].value = cl.get('J','')   # Award Amount = column J (Awarded Value)
        ws[f'T{row_num}'].value = cl.get('I','')
        ws[f'U{row_num}'].value = cl.get('J','')

    for col in NEW_COLS:
        c = ws[f'{col}{row_num}']
        c.border = THIN
        c.alignment = WRAP
        if scope_lower in [k for k,v in SCOPE_TO_CN.items() if k.startswith('led') or k.startswith('ice') or k.startswith('site')]:
            c.fill = GOLD_FILL

    # Gray out rows with no contract match (in column L-N)
    if not cl:
        for col in ['L','M','N','O','P','Q','R','S','T','U']:
            ws[f'{col}{row_num}'].font = Font(color='999999', italic=True)

# ── Append design/consultant contracts ──
design_entries = ['C-01', 'C-02', 'L-01', 'L-02', 'L-03', 'L-04', 'L-05']
# Find existing contracts already in matrix (from scope mapping)
existing_cns = set()
for row_num in range(5, ws.max_row + 1):
    v = ws[f'L{row_num}'].value
    if v and str(v).strip() != '':
        existing_cns.add(str(v).strip())

next_row = ws.max_row + 1

# Section header
ws.cell(row=next_row, column=1).value = 'CONSULTANT & DESIGN CONTRACTS'
for col_idx in range(1, 22):
    c = ws.cell(row=next_row, column=col_idx)
    c.fill = SEC_FILL
    c.border = THIN
c = ws.cell(row=next_row, column=1)
c.font = SEC_FONT
next_row += 1

for cn in design_entries:
    if cn not in cl_by_cn:
        continue
    if cn in existing_cns and cn != 'L-05':
        continue  # already in matrix (but L-05/JCI is OPOI so add anyway)

    vals = cl_by_cn[cn]
    bp = vals.get('M','')
    scope_desc = vals.get('L','')
    budget = vals.get('F','')
    vendor = vals.get('E','')

    ws.cell(row=next_row, column=1).value = bp
    ws.cell(row=next_row, column=2).value = scope_desc
    ws.cell(row=next_row, column=3).value = budget
    ws.cell(row=next_row, column=10).value = ''  # Status
    ws.cell(row=next_row, column=12).value = cn
    ws.cell(row=next_row, column=13).value = vendor
    ws.cell(row=next_row, column=14).value = vals.get('A','')
    ws.cell(row=next_row, column=15).value = vals.get('B','')
    ws.cell(row=next_row, column=16).value = vals.get('C','')
    ws.cell(row=next_row, column=17).value = vals.get('G','')
    ws.cell(row=next_row, column=18).value = vals.get('H','')
    ws.cell(row=next_row, column=19).value = vals.get('J','')
    ws.cell(row=next_row, column=20).value = vals.get('I','')
    ws.cell(row=next_row, column=21).value = vals.get('J','')

    for col_idx in range(1, 22):
        c = ws.cell(row=next_row, column=col_idx)
        c.border = THIN
        c.alignment = WRAP

    next_row += 1

# ── Remove Contract Log sheet ──
del wb['Contract Log']

# ── Save ──
wb.save(DST)
print(f'✅ Merged file: {DST}')
print(f'   Sheets: {wb.sheetnames}')
print(f'   Buyout Matrix rows: {ws.max_row}')
print(f'   Columns: A-U (21 cols)')