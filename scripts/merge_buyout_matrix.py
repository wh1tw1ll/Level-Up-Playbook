#!/usr/bin/env python3
"""Merge Contract Log columns into Buyout Matrix tab, then remove Contract Log sheet."""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from copy import copy

SRC = r'C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents\00 - LUNA Output\02 - DOVA Arena\DOVA_Buyout_Matrix_Contract_Log.xlsx'
DST = r'C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents\00 - LUNA Output\02 - DOVA Arena\DOVA_Buyout_Matrix.xlsx'

# ── Styles ──────────────────────────────────────────
HEADER_FONT = Font(bold=True, color='FFFFFF', size=10)
HEADER_FILL = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
SECTION_FONT = Font(bold=True, color='1F4E79', size=11)
SECTION_FILL = PatternFill(start_color='D6E4F0', end_color='D6E4F0', fill_type='solid')
GOLD_FONT = Font(bold=True, color='C4962B', size=10)
GOLD_FILL = PatternFill(start_color='FFF8E1', end_color='FFF8E1', fill_type='solid')
THIN_BORDER = Border(
    left=Side(style='thin', color='D0D0D0'),
    right=Side(style='thin', color='D0D0D0'),
    top=Side(style='thin', color='D0D0D0'),
    bottom=Side(style='thin', color='D0D0D0'),
)
WRAP = Alignment(wrap_text=True, vertical='top')

wb = openpyxl.load_workbook(SRC)

# ── Read Contract Log ───────────────────────────────
ws_cl = wb['Contract Log']
cl_rows = {}  # BP_# -> row dict
for row in ws_cl.iter_rows(min_row=5, max_row=ws_cl.max_row):
    vals = {}
    for c in row:
        if c.value is not None:
            vals[c.column_letter] = c.value
    bp = str(vals.get('M', '') or '').strip()
    if bp and bp != 'N/A':
        cl_rows[bp] = vals

# Also index by contract number for design contracts
cl_by_cn = {}
for bp_key, vals in cl_rows.items():
    cn = str(vals.get('D', '') or '').strip()
    if cn:
        cl_by_cn[cn] = vals

# ── New columns to add: col L through col U ─────────
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

NEW_COL_LETTERS = ['L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U']

# Scope-to-contract key mapping (scope name lowered -> BP_#)
SCOPE_TO_BP = {
    'structural steel — supply & erection': 'BP-01',
    'concrete — self perform': 'BP-01',
    'reinforcing & pt': 'BP-01',
    'mechanical (hvac) — db': 'BP-01',
    'plumbing — db': 'BP-01',
    'electrical — db': 'BP-01',
    'fire protection — db': 'BP-01',
    'elevators / escalators': 'BP-01',
    'metal decking': 'BP-01',
    'earthwork / site prep': 'BP-01',
    'precast concrete (sps)': 'BP-01',
    'glazing / glass & glazing': 'BP-02',
    'roofing': 'BP-02',
    'metal panels': 'BP-02',
    'sheet metal & flashing': 'BP-02',
    'waterproofing / dampproofing': 'BP-02',
    'fireproofing': 'BP-02',
    'stucco / eifs': 'BP-02',
    'overhead doors & grilles': 'BP-02',
    'joint sealants': 'BP-02',
    'civil / sitework (outside mccarthy)': None,
    'doors, frames & hardware': 'BP-03',
    'metal studs & drywall (sp)': 'BP-03',
    'acoustical ceilings & walls': 'BP-03',
    'tile': 'BP-03',
    'communications / it': 'BP-03',
    'security': 'BP-03',
    'fixed seating (irwin)': 'BP-04',
    'turf / furniture / nba seating': 'BP-04',
    'finish carpentry / casework': 'BP-04',
    'carpet & resilient flooring': 'BP-04',
    'special flooring (wood/athletic)': 'BP-04',
    'painting & wallcovering': 'BP-04',
    'signage': 'BP-04',
    'food service equipment': 'BP-04',
    'loading dock equipment': 'BP-04',
    'lockers': 'BP-04',
    'misc specialties': 'BP-04',
    'toilet partitions & accessories': 'BP-04',
    'athletic equipment': 'BP-04',
    'interior glass': 'BP-04',
    'misc metals / stairs / railings': 'BP-04',
    'acoustical ceilings & walls': 'BP-03',
    'carpet & resilient flooring': 'BP-04',
    'special flooring (wood/athletic)': 'BP-04',
    'painting & wallcovering': 'BP-04',
    'interior glass': 'BP-04',
    'site & plaza development': 'OPOI',
    'ice ready infrastructure': 'OPOI',
    'led / media mesh / halo': 'OPOI',
    'ahl provisions': 'OPOI',
    'exterior leds': 'OPOI',
    'central plant / cup (jci)': 'OPOI',
}

# ── Write new headers in row 4 ──────────────────────
ws = wb['Buyout Matrix']
for i, (hdr, width) in enumerate(NEW_HEADERS):
    col = NEW_COL_LETTERS[i]
    cell = ws[f'{col}4']
    cell.value = hdr
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = Alignment(horizontal='center', wrap_text=True)
    cell.border = THIN_BORDER
    ws.column_dimensions[col].width = width

# ── Helper to get contract data for a scope row ─────
def get_contract_for_scope(scope_name):
    """Return (cl_vals_dict_or_None) for a scope row."""
    if not scope_name:
        return None
    key = scope_name.strip().lower()
    bp = SCOPE_TO_BP.get(key)
    if bp and bp in cl_rows:
        return cl_rows[bp]
    return None

# ── Fill data rows ──────────────────────────────────
header_row_count = 4
data_start_row = 5

# First pass: write merged columns for existing rows
for row_num in range(data_start_row, ws.max_row + 1):
    scope = ws[f'B{row_num}'].value
    bp_col = ws[f'A{row_num}'].value
    
    # Category header row (has BP-XX in col A but not a scope line)
    if bp_col and not scope:
        # Leave new columns blank
        for col in NEW_COL_LETTERS:
            ws[f'{col}{row_num}'].fill = SECTION_FILL
            ws[f'{col}{row_num}'].border = THIN_BORDER
        continue
    
    if not scope:
        continue  # Empty row
    
    # Try to match scope to contract
    cl_data = get_contract_for_scope(scope)
    
    if cl_data:
        cn = cl_data.get('D', '')
        vendor = cl_data.get('E', '')
        proc_status = cl_data.get('A', '')
        loi_lntp = cl_data.get('B', '')
        contract_date = cl_data.get('C', '')
        pending = cl_data.get('G', '')
        final_award = cl_data.get('H', '')
        approved_cos = cl_data.get('I', '')
        awarded_value = cl_data.get('J', '')
    else:
        cn = ''
        vendor = ''
        proc_status = ''
        loi_lntp = ''
        contract_date = ''
        pending = ''
        final_award = ''
        approved_cos = ''
        awarded_value = ''
    
    cell_values = [cn, vendor, proc_status, loi_lntp, contract_date, 
                   pending, final_award, approved_cos, awarded_value]
    
    for i, val in enumerate(cell_values):
        col = NEW_COL_LETTERS[i]
        cell = ws[f'{col}{row_num}']
        cell.value = val
        cell.border = THIN_BORDER
        cell.alignment = WRAP
        # If OPOI scope, gold highlight
        if str(scope).strip().lower() in [k for k, v in SCOPE_TO_BP.items() if v == 'OPOI']:
            cell.fill = GOLD_FILL

# ── Append design/consultant contracts as new rows ──
design_contracts = ['L-01', 'L-02', 'L-03', 'L-04', 'L-05', 'C-01', 'C-02']
existing_scope_bp_keys = set(SCOPE_TO_BP.values())

next_row = ws.max_row + 1

# Add section header
ws.cell(row=next_row, column=1).value = 'CONSULTANT & DESIGN CONTRACTS'
ws.cell(row=next_row, column=1).font = SECTION_FONT
ws.cell(row=next_row, column=1).fill = SECTION_FILL
for col in ['A','B','C','D','E','F','G','H','I','J','K']:
    ws.cell(row=next_row, column=openpyxl.utils.column_index_from_string(col)).fill = SECTION_FILL
    ws.cell(row=next_row, column=openpyxl.utils.column_index_from_string(col)).border = THIN_BORDER
for col in NEW_COL_LETTERS:
    ws[f'{col}{next_row}'].fill = SECTION_FILL
    ws[f'{col}{next_row}'].border = THIN_BORDER
next_row += 1
ws.merge_cells(start_row=next_row-1, start_column=1, end_row=next_row-1, end_column=11)

for cn in design_contracts:
    if cn in cl_by_cn:
        vals = cl_by_cn[cn]
        ws.cell(row=next_row, column=1).value = vals.get('M', '')  # BP #
        ws.cell(row=next_row, column=2).value = vals.get('L', '')  # Scope Desc
        ws.cell(row=next_row, column=3).value = vals.get('F', '')  # Budget
        ws.cell(row=next_row, column=10).value = ''  # Status - blank for design contracts        
        ws.cell(row=next_row, column=12).value = vals.get('D', '')  # Contract #
        ws.cell(row=next_row, column=13).value = vals.get('E', '')  # Vendor
        ws.cell(row=next_row, column=14).value = vals.get('A', '')  # Proc Status
        ws.cell(row=next_row, column=15).value = vals.get('B', '')  # LOI/LNTP
        ws.cell(row=next_row, column=16).value = vals.get('C', '')  # Contract Date
        ws.cell(row=next_row, column=17).value = vals.get('G', '')  # Pending
        ws.cell(row=next_row, column=18).value = vals.get('H', '')  # Final Award
        ws.cell(row=next_row, column=19).value = vals.get('I', '')  # Award Amount (mapped to col I)
        ws.cell(row=next_row, column=20).value = vals.get('J', '')  # Awarded Value
        
        for col_letter in ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U']:
            c = ws[f'{col_letter}{next_row}']
            c.border = THIN_BORDER
            c.alignment = WRAP
            # Gold for OPOI scopes
            if str(vals.get('M', '') or '').strip() == 'OPOI':
                c.fill = GOLD_FILL
        
        next_row += 1

# ── Remove Contract Log sheet ─────────────────────
# Copy Project Team sheet
ws_pt = wb['Project Team']

# Delete Contract Log sheet
del wb['Contract Log']

# ── Save ──────────────────────────────────────────
wb.save(DST)
print(f'✅ Saved merged file to: {DST}')
print(f'   - Buyout Matrix tab has {ws.max_row} rows + {len(design_contracts)} new design rows')
print(f'   - Contract Log tab removed (data merged into Buyout Matrix)')
print(f'   - Project Team tab preserved')