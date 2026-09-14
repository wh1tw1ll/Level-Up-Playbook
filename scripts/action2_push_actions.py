#!/usr/bin/env python3
"""Action 2: Push all 33 actions from Excel to Smartsheet Action Tracker"""
import json, requests, os

#Read token from file
tp=os.path.expanduser('~/.hermes/.smartsheet_token')
with open(tp) as f: TOKEN=f.read()
if len(TOKEN)!=37:print(f'Token issue: len={len(TOKEN)}')
TOKEN=TOKEN.strip()

SHEET_ID='4456864287772548'
H={'Authorization':f'Bearer {TOKEN}','Content-Type':'application/json'}

#Col IDs
C={'AID':6748787438817156,'ADESC':4496987625131908,'OWN':9000587252502404,
   'DD':6582137294724,'PRI':4510181764665220,'STAT':2258381950979972,'DEP':6761981578350468}

actions=[
('DOVA-ACT-01','P&W Owner-Direct Transition - Negotiate SD scope, fee, schedule','wwilliams@levelup-pd.com','2026-06-30','High','In Progress',''),
('DOVA-ACT-02','McCarthy Precon Reset - Transition to CM preconstruction','wwilliams@levelup-pd.com','2026-06-30','High','In Progress',''),
('DOVA-ACT-03','SD Launch / All-Hands Design Kickoff','wwilliams@levelup-pd.com','2026-07-07','High','Open',''),
('DOVA-ACT-04','Planning Commission Hearing Prep - July 22','joshua.wood@kozpure.com','2026-07-16','High','Open',''),
('DOVA-ACT-05','City Council Hearing Prep - August 17','joshua.wood@kozpure.com','2026-08-10','High','Open',''),
('DOVA-ACT-06','Environmental SSHCP - Condition with City','charlie@kozpure.com','2026-07-15','Medium','In Progress',''),
('DOVA-ACT-07','SMUD Utility Coordination - Power Service/Switchgear','charlie@kozpure.com','2026-08-01','Critical','Critical',''),
('DOVA-ACT-08','PG&E Gas Application','wood.rodgers@engineer.com','2026-07-15','Medium','Pending','DOVA-ACT-07'),
('DOVA-ACT-09','Budget Baseline Confirmation - $175M Arena Target','wwilliams@levelup-pd.com','2026-07-07','High','In Progress',''),
('DOVA-ACT-10','JCI Financing - Tech Package Strategy','joshua.wood@kozpure.com','2026-07-15','Medium','Open',''),
('DOVA-ACT-11','Master Schedule Development - KozPure Goals','wwilliams@levelup-pd.com','2026-07-07','High','In Progress',''),
('DOVA-ACT-12','CM Precon Services Agreement - Finalize and Send','wwilliams@levelup-pd.com','2026-07-03','High','In Progress',''),
('DOVA-ACT-13','Gas vs All-Electric Decision - Cooking/Heating','joshua.wood@kozpure.com','2026-07-15','High','Open',''),
('DOVA-ACT-14','Construction Power Plan - Temp Power Sep 2026','mccarthy@mccarthy.com','2026-07-15','High','Open',''),
('DOVA-ACT-15','McCarthy Qualifications Review - 8 Missing Lines','wwilliams@levelup-pd.com','2026-07-07','Medium','In Progress',''),
('DOVA-ACT-16','JCI Budget Clarification - CUP/Foundation Scope','wwilliams@levelup-pd.com','2026-07-07','High','In Progress',''),
('DOVA-ACT-17','Master Budget Work Session - Week of 7/6','wwilliams@levelup-pd.com','2026-07-10','High','Open',''),
('DOVA-ACT-18','Project Dashboard/Portal - KozPure Reporting','wwilliams@levelup-pd.com','2026-07-15','Medium','Open',''),
('DOVA-ACT-19','June Monthly Invoices - Review and Submit','wwilliams@levelup-pd.com','2026-07-07','Medium','In Progress',''),
('DOVA-ACT-20','Level Up Contract Status - Finalize Terms','wwilliams@levelup-pd.com','2026-07-07','High','In Progress',''),
('DOVA-ACT-21','CM Alignment - Budget, Schedule, Delivery Method','wwilliams@levelup-pd.com','2026-07-07','High','Open',''),
('DOVA-ACT-22','Wood Rodgers Scope - Wet Utilities, Civil, Landscape','wwilliams@levelup-pd.com','2026-07-01','Medium','In Progress',''),
('DOVA-ACT-23','MDR Submittal Completion - Building Placement','mccarthy@mccarthy.com','2026-07-10','High','In Progress',''),
('DOVA-ACT-24','Project Transition - Knowledge Transfer from Chuck','wwilliams@levelup-pd.com','2026-06-23','High','Completed',''),
('DOVA-ACT-25','McCarthy Data Dump - Schedule, Estimate, Deliverables','mccarthy@mccarthy.com','2026-07-03','High','Open',''),
('DOVA-ACT-26','SMUD Application - AutoCAD Site Plan','wood.rodgers@engineer.com','2026-07-10','High','Open',''),
('DOVA-ACT-27','SMUD Application - Civil Plans and Improvement Plans','wood.rodgers@engineer.com','2026-07-10','High','Open','DOVA-ACT-26'),
('DOVA-ACT-28','SMUD Application - Single Line Diagram and Load Calc','mep@engineer.com','2026-07-17','High','Open',''),
('DOVA-ACT-29','SMUD Application - Pumping Details (HP + LRA)','mep@engineer.com','2026-07-17','High','Open',''),
('DOVA-ACT-30','Temporary Power - Confirm Option 3','wwilliams@levelup-pd.com','2026-07-07','High','Open',''),
('DOVA-ACT-31','SMUD Application - Complete Submission in 30 Days','wwilliams@levelup-pd.com','2026-08-01','High','Open','DOVA-ACT-26,27,28,29'),
('DOVA-ACT-32','Bloom Energy Intentions - Clarify for SMUD','joshua.wood@kozpure.com','2026-07-15','Medium','Open',''),
('DOVA-ACT-33','Solar Intentions - Clarify for SMUD Telemetry','joshua.wood@kozpure.com','2026-07-15','Medium','Open','')
]

#Delete existing rows
print('Deleting existing rows...')
r=requests.get(f'https://api.smartsheet.com/2.0/sheets/{SHEET_ID}',headers=H)
existing=[str(rr['id']) for rr in r.json().get('rows',[])]
if existing:
    ids=','.join(existing)
    d=requests.delete(f'https://api.smartsheet.com/2.0/sheets/{SHEET_ID}/rows?ids={ids}',headers=H)
    print(f'  Deleted {len(existing)} rows: {d.status_code}')

#Build rows
rows=[]
for a in actions:
    cells=[
        {'columnId':C['AID'],'value':a[0]},
        {'columnId':C['ADESC'],'value':a[1]},
        {'columnId':C['OWN'],'value':a[2]},
        {'columnId':C['DD'],'value':a[3]},
        {'columnId':C['PRI'],'value':a[4]},
        {'columnId':C['STAT'],'value':a[5]}
    ]
    if a[6]: cells.append({'columnId':C['DEP'],'value':a[6]})
    rows.append({'cells':cells})

#Push - bare array format
print(f'Pushing {len(rows)} actions...')
r=requests.post(f'https://api.smartsheet.com/2.0/sheets/{SHEET_ID}/rows',headers=H,jso$
if r.ok:
    res=r.json()
    print(f'  {res.get(\"message\")} - {len(res.get(\"result\",[]))} rows')
else:
    print(f'  ERROR {r.status_code}: {r.text[:300]}')

#Verify
r=requests.get(f'https://api.smartsheet.com/2.0/sheets/{SHEET_ID}',headers=H)
d=r.json()
print(f'\\nAction Tracker: {len(d.get(\"rows\",[]))} rows')
for rw in d.get('rows',[]):
    vs=[str(c.get('value',''))[:25] for c in rw.get('cells',[]) if c.get('value')]
    print(f'  Row {rw.get(\"rowNumber\")}: {\" | \".join(vs[:3])}')