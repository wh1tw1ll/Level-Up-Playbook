import openpyxl, json

tracker_path = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/01 - Project Management/02 - Logs/01 - Action Items/01 - Owner Action Items/LUNA Action Tracker.xlsx"

try:
    wb = openpyxl.load_workbook(tracker_path, data_only=True)
    ws = wb['Active Actions']
    
    # Col indices (0-based): 0=ID, 1=Date Created, 2=Task, 3=Category, 4=Source, 5=Lead, 6=Due, 7=Status, 8=Priority, 9=Created log, 10=Notes
    # Row 1 is header
    open_items = []
    summary_count = 0
    
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        vals = [str(v)[:200] if v is not None else '' for v in row]
        
        # Check if this is a data row (has an ID in col 0 that's numeric)
        if len(vals) > 0 and vals[0].strip().isdigit():
            status = vals[7].lower().strip() if len(vals) > 7 else ''
            if any(kw in status for kw in ['open', 'in progress', 'pending', 'overdue']):
                open_items.append({
                    'id': vals[0],
                    'date_created': vals[1] if len(vals) > 1 else '',
                    'task': vals[2] if len(vals) > 2 else '',
                    'category': vals[3] if len(vals) > 3 else '',
                    'source': vals[4] if len(vals) > 4 else '',
                    'lead': vals[5] if len(vals) > 5 else '',
                    'due_date': vals[6] if len(vals) > 6 else '',
                    'status': vals[7] if len(vals) > 7 else '',
                    'priority': vals[8] if len(vals) > 8 else '',
                    'notes': vals[10] if len(vals) > 10 else ''
                })
        elif any(kw in str(vals).lower() for kw in ['total open:', 'high priority:', 'project:', 'personal:', 'summary']):
            summary_count += 1
            # Capture summary data
            label = vals[0] if vals else ''
            value = vals[1] if len(vals) > 1 else ''
            print(f"SUMMARY: {label} -> {value}")
    
    print(f"ACTIVE OPEN ITEMS: {len(open_items)}")
    
    # Sort by priority: High first, then Med, then Low
    priority_order = {'high': 0, 'med': 1, 'low': 2, '': 3}
    open_items.sort(key=lambda x: priority_order.get(x['priority'].lower().strip(), 3))
    
    for item in open_items:
        print(json.dumps(item, default=str))
    
    wb.close()
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()