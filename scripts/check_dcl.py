import os

d = "C:/Users/HermesAdmin/OneDrive - levelup-pd.com/Documents - Level Up/02 - Miami Freedom Park Stadium/02 - Contracts & Legal/05 - Trade Contracts/23 - DCL (LED Video Boards + Signage In Bowl)"
print("dir exists:", os.path.exists(d))

# List matching files
for f in sorted(os.listdir(d)):
    full = os.path.join(d, f).replace(os.sep, '/')
    size = os.path.getsize(full)
    if size > 100000:
        ext = os.path.splitext(f)[1].lower()
        if ext == '.pdf':
            print(f"  {f[:80]:80s} {size//1024:>6}KB")

# Check specific file  
target = d + "/MFP-Lemartec -- CM as Agent Agreement (Trade Contractor Agreement) FINAL 1.13.25.pdf"
print(f"\nExists: {os.path.exists(target)}")
print(f"Path: {target}")

# Try opening with raw bytes  
try:
    with open(target, 'rb') as fh:
        header = fh.read(5)
        print(f"File header: {header}")
except Exception as e:
    print(f"Open error: {e}")