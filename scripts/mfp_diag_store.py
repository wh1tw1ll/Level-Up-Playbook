#!/usr/bin/env python3
"""Diagnostic: List all Outlook stores and their folder trees."""
import sys, pythoncom, win32com.client
pythoncom.CoInitialize()

ol = win32com.client.Dispatch("Outlook.Application")
ns = ol.GetNamespace("MAPI")

print("=== OUTLOOK STORES ===")
for i in range(1, ns.Folders.Count + 1):
    s = ns.Folders.Item(i)
    print(f"  Store {i}: Name='{s.Name}'")

# Also dump top-level folders of each store
print()
for i in range(1, ns.Folders.Count + 1):
    s = ns.Folders.Item(i)
    print(f"--- Folders in '{s.Name}' ---")
    for j in range(1, s.Folders.Count + 1):
        f = s.Folders.Item(j)
        print(f"  Folder: '{f.Name}'")
        for k in range(1, f.Folders.Count + 1):
            sf = f.Folders.Item(k)
            print(f"    Subfolder: '{sf.Name}'")
    print()

pythoncom.CoUninitialize()
print("=== DIAGNOSTIC COMPLETE ===")