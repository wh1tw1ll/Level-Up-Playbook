#!/usr/bin/env python3
import re
with open(r'public/js/app-daily-manager.js', 'r') as f:
    content = f.read()
onclick_fns = set()
for m in re.finditer(r'onclick="[^"]*?(\w+)\s*\(', content):
    onclick_fns.add(m.group(1))
func_defs = set()
for m in re.finditer(r'^function\s+(\w+)\s*\(', content, re.MULTILINE):
    if m.lastindex >= 1:
        func_defs.add(m.group(1))
print("onclick functions:", sorted(onclick_fns))
print()
print("Need to expose:")
for fn in sorted(onclick_fns - {'event', 'stopPropagation', 'void', 'function'}):
    if fn in func_defs:
        for m in re.finditer(r'^function\s+' + re.escape(fn) + r'\s*\(', content, re.MULTILINE):
            line_num = content[:m.start()].count('\n') + 1
            print(f"  {fn} -> line {line_num}")
    else:
        print(f"  {fn} -> NOT DEFINED LOCALLY")