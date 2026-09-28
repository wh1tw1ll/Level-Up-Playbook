cmd.exe /c "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe -c "
import pythoncom, win32com.client, json, os, re
from datetime import datetime, timezone, timedelta

SINCE_STR = '2026-09-25T06:02:22Z'
try:
    with open(r'C:\Users\HermesAdmin\.hermes\last_run.json') as f:
        lr = json.load(f)
    SINCE_STR = lr.get('email_morning_scan', SINCE_STR)
except: pass
SINCE = datetime.fromisoformat(SINCE_STR.replace('Z', '+00:00'))

RESULTS = {'store_names': [], 'folders_scanned': 0, 'staged': 0, 'skipped': 0, 'new_items': [], 'stores_found': 0, 'error': None}

def w(msg):
    print(msg, flush=True)

w('=== MFP Mail Scan via schtasks bridge ===')
w('Scan since: ' + SINCE_STR)

try:
    pythoncom.CoInitialize()
    ol = win32com.client.Dispatch('Outlook.Application')
    ns = ol.GetNamespace('MAPI')
    w('MAPI OK. Stores: ' + str(ns.Folders.Count))
    
    for i in range(1, ns.Folders.Count + 1):
        s = ns.Folders.Item(i)
        name = s.Name
        RESULTS['store_names'].append(name)
        w('  Store ' + str(i) + ': ' + name)
    
    RESULTS['stores_found'] = len(RESULTS['store_names'])
    
    # Find MFP store
    ms = None
    for name in RESULTS['store_names']:
        n = name.lower()
        if any(kw in n for kw in ['miamifreedompark', 'freedom park', 'mfp']):
            ms = ns.Folders.Item(RESULTS['store_names'].index(name) + 1)
            w('Found MFP store: ' + name)
            break
    
    if ms:
        w('Scanning MFP folders...')
        EXCLUDE = ['junk', 'deleted items', 'drafts', 'rss', 'conversation history', 'outbox']
        folders_to_scan = []
        
        def walk_folders(parent, path=''):
            for j in range(1, parent.Folders.Count + 1):
                f = parent.Folders.Item(j)
                fname = f.Name.lower()
                if any(e in fname for e in EXCLUDE): continue
                fpath = path + '/' + f.Name if path else f.Name
                folders_to_scan.append((f, fpath))
                walk_folders(f, fpath)
        
        walk_folders(ms)
        w('MFP folders to scan: ' + str(len(folders_to_scan)))
        
        for folder, fpath in folders_to_scan:
            try:
                items = folder.Items
                items.Sort('[ReceivedTime]', True)
                count = 0
                for k in range(min(50, items.Count)):
                    try:
                        msg = items.Item(k + 1)
                        rt = msg.ReceivedTime
                        if rt:
                            rt_dt = datetime(rt.year, rt.month, rt.day, rt.hour, rt.minute, rt.second, tzinfo=timezone.utc)
                            if rt_dt < SINIE: continue
                        body = str(msg.Body or '')[:1000]
                        subj = str(msg.Subject or '')
                        sender = str(msg.SenderName or '')
                        results.append((subj, sender, body, fpath))
                        count += 1
                    except: continue
                if count > 0:
                    RESULTS['folders_scanned'] += 1
                    w('  ' + fpath + ': ' + str(count))
            except Exception as e:
                w('  ' + fpath + ': err - ' + str(e)[:60])
        else:
            w('MFP store not found')
        
        pythoncom.CoUninitialize()
    except Exception as e:
        RESULTS['error'] = str(e)
        w('Error: ' + str(e))
    
    with open(r'C:\Users\HermesAdmin\.hermes\mfp_bridge_result.json', 'w') as f:
        json.dump(RESULTS, f, indent=2)
    w('=== Done ===')
" 2>C:\Users\HermesAdmin\.hermes\mfp_bridge_err.txt > C:\Users\HermesAdmin\.hermes\mfp_bridge_out.txt