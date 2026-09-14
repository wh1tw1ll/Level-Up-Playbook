#!/usr/bin/env python3
"""Add missing action items from Greg's agenda to Smartsheet via Vercel deploy."""
import json

# The missing action items that need to be added
# Sheet 03 has columns: Action ID, Action Description, Owner, Due Date, Priority, Status, Depends On

NEW_ACTIONS = [
    # From Greg's agenda items not in current tracker
    {
        'Action ID': 'A-039',
        'Action Description': 'Expedite P&W AIA contract - provide today if possible; Level Up to review business terms; KozPure legal to review concurrently',
        'Owner': 'P&W',
        'Due Date': '2026-06-26',
        'Priority': 'Critical',
        'Status': 'Pending',
        'Depends On': 'A-022'
    },
    {
        'Action ID': 'A-040',
        'Action Description': 'Resolve P&W fee / budget basis open question - agree which budget number 6.5% fee is based on (McCarthy estimate vs target budget)',
        'Owner': 'KozPure',
        'Due Date': '2026-07-06',
        'Priority': 'Critical',
        'Status': 'Pending',
        'Depends On': 'A-022'
    },
    {
        'Action ID': 'A-041',
        'Action Description': 'Award CM preconstruction services no later than July 13 to support September groundbreaking',
        'Owner': 'KozPure',
        'Due Date': '2026-07-13',
        'Priority': 'Critical',
        'Status': 'Pending',
        'Depends On': 'A-035'
    },
    {
        'Action ID': 'A-042',
        'Action Description': 'Decide CM path forward after McCarthy feedback on CM Precon Agreement - proceed with McCarthy, pivot to Turner/Level 10/Swinerton, or other',
        'Owner': 'Level Up',
        'Due Date': '2026-07-07',
        'Priority': 'High',
        'Status': 'Pending',
        'Depends On': 'A-035'
    },
    {
        'Action ID': 'A-043',
        'Action Description': 'Schedule Turner Construction follow-up meeting (Clint Williams + Drake Costa + John Gromos)',
        'Owner': 'Greg',
        'Due Date': '2026-07-03',
        'Priority': 'High',
        'Status': 'Pending',
        'Depends On': ''
    },
    {
        'Action ID': 'A-044',
        'Action Description': 'Follow up with Swinerton (Jeff) and SB James (Heman) for CM outreach',
        'Owner': 'Greg',
        'Due Date': '2026-07-03',
        'Priority': 'Medium',
        'Status': 'Pending',
        'Depends On': ''
    },
    {
        'Action ID': 'A-045',
        'Action Description': 'Obtain executed P&W contract before signing engineers/consultants - Don needs contract to proceed',
        'Owner': 'KozPure',
        'Due Date': '2026-07-06',
        'Priority': 'Critical',
        'Status': 'Pending',
        'Depends On': 'A-039'
    },
    {
        'Action ID': 'A-046',
        'Action Description': 'Launch Level Up Dashboard - complete dashboard build and deploy for KozPure review',
        'Owner': 'Level Up',
        'Due Date': '2026-06-30',
        'Priority': 'High',
        'Status': 'In Progress',
        'Depends On': ''
    },
    {
        'Action ID': 'A-047',
        'Action Description': 'Complete DOVA master schedule for City submittal - Josh requested City-ready schedule',
        'Owner': 'Level Up',
        'Due Date': '2026-06-30',
        'Priority': 'High',
        'Status': 'In Progress',
        'Depends On': 'A-033'
    },
]

print('Actions to add:')
for a in NEW_ACTIONS:
    print(f'  {a["Action ID"]}: {a["Action Description"][:55]} | {a["Owner"]} | Due: {a["Due Date"]} | {a["Priority"]}')

print()
print('Total: {} new action items'.format(len(NEW_ACTIONS)))
print()
print('These need to be written to Smartsheet Sheet 03 (ID: 4456864287772548)')
print()
print('The Smartsheet API token is in Vercel env vars - need to either:')
print('  1. Create a deployment endpoint that writes these rows')
print('  2. Get the SMARTSHEET_TOKEN from Vercel')