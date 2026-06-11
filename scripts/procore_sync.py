# procore_sync.py — Procore Stealth Data Sync
# Uses YOUR Chrome login session. No company install needed.
#
# INSTALL (one time):
#   pip install playwright beautifulsoup4 requests
#   python -m playwright install chromium
#
# USAGE:
#   Close all Chrome windows first.
#   Then: python procore_sync.py
#
# WHAT IT DOES:
#   1. Launches Chrome using YOUR profile (you stay logged into Procore)
#   2. Navigates to commitments page
#   3. Waits for data to load
#   4. Extracts vendor names, amounts, payments
#   5. Saves as JSON to Level-Up-Playbook/data/
#   6. Closes cleanly — Lemartec sees nothing

import json, os, time, re, datetime, sys
from bs4 import BeautifulSoup

# ─── CONFIG ──────────────────────────────────────────────────────────
PROJECT_ID = "2916773"
PROJECT_NAME = "Miami Freedom Park Stadium"
PLAYBOOK_DIR = os.path.expanduser("~/Level-Up-Playbook")
OUTPUT_DIR = os.path.join(PLAYBOOK_DIR, "data")
CHROME_PROFILE = os.path.expanduser("~/AppData/Local/Google/Chrome/User Data")

# ─── LAUNCH ──────────────────────────────────────────────────────────
def run():
    print("=" * 60)
    print("PROCORE STEALTH SYNC")
    print("=" * 60)
    print()

    # Launch Playwright
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        print("1. Launching Chrome with your profile...")
        browser = p.chromium.launch_persistent_context(
            user_data_dir=CHROME_PROFILE,
            headless=False,  # Set to True for silent operation
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ]
        )
        page = browser.new_page()

        # Step 2: Navigate to commitments
        print(f"2. Loading Project {PROJECT_ID} commitments...")
        page.goto(f"https://app.procore.com/{PROJECT_ID}/project/commitments", 
                   wait_until="networkidle", timeout=30000)
        time.sleep(3)  # Extra time for React rendering

        # Step 3: Check if we're logged in
        title = page.title()
        print(f"   Page title: {title}")
        if "login" in title.lower() or "sign in" in title.lower():
            print("   NOT LOGGED IN. Please log into Procore first, then re-run.")
            browser.close()
            return

        # Step 4: Extract data
        print("3. Extracting commitment data...")

        # Strategy A: Try to find a table with commitment data
        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Look for tables
        tables = soup.find_all("table")
        print(f"   Found {len(tables)} tables")

        # Strategy B: Try page.evaluate to check for React app state
        print("4. Checking for structured data...")

        # Try to find Procore's internal state
        app_state = page.evaluate("""() => {
            // Look for the app state in various places
            let result = {};

            // Check window.__NEXT_DATA__ (Next.js apps)
            let el = document.getElementById('__NEXT_DATA__');
            if (el) result.nextData = el.textContent.substring(0, 10000);

            // Check window.__INITIAL_STATE__
            if (window.__INITIAL_STATE__) result.initialState = JSON.stringify(window.__INITIAL_STATE__).substring(0, 10000);

            // Check window.__PRELOADED_STATE__
            if (window.__PRELOADED_STATE__) result.preloaded = JSON.stringify(window.__PRELOADED_STATE__).substring(0, 10000);

            // Check for Apollo/Relay cache (GraphQL)
            if (window.__APOLLO_STATE__) result.apollo = JSON.stringify(window.__APOLLO_STATE__).substring(0, 10000);
            if (window.__RELAY_STORE__) result.relay = JSON.stringify(window.__RELAY_STORE__).substring(0, 10000);

            // Look for any script with 'commitment' in it
            let scripts = document.querySelectorAll('script');
            for (let s of scripts) {
                if (s.textContent && s.textContent.includes('commitment')) {
                    result.foundCommitment = s.textContent.substring(0, 5000);
                    break;
                }
            }

            // Try to extract data from rendered table cells
            let rows = document.querySelectorAll('tr');
            result.rowCount = rows.length;
            let rowData = [];
            for (let r of rows) {
                let cells = r.querySelectorAll('td, th');
                if (cells.length > 0) {
                    rowData.push(Array.from(cells).map(c => c.textContent.trim()).join(' | '));
                }
            }
            result.rows = rowData.slice(0, 50);

            // Check for XHR/fetch data in performance entries
            let perf = performance.getEntriesByType('resource');
            let apiCalls = perf.filter(e => e.name.includes('procore'));
            result.apiCalls = apiCalls.slice(0, 20).map(e => ({
                url: e.name.substring(0, 150),
                duration: e.duration
            }));

            return result;
        }""")

        # Save everything
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        output = {
            "timestamp": ts,
            "project": PROJECT_NAME,
            "project_id": PROJECT_ID,
            "app_state": app_state,
            "page_title": title,
            "table_count": len(tables),
        }

        # Also extract table HTML for fallback parsing
        for i, table in enumerate(tables):
            output[f"table_{i}_html"] = str(table)[:20000]

        filepath = os.path.join(OUTPUT_DIR, f"procore_commitments_{ts}.json")
        with open(filepath, "w") as f:
            json.dump(output, f, indent=2, default=str)

        print(f"\n5. Data saved: {filepath}")
        print(f"   Found {app_state.get('rowCount', 0)} table rows")

        # Show API calls detected
        api_calls = app_state.get('apiCalls', [])
        if api_calls:
            print(f"\n   Detected {len(api_calls)} Procore API calls:")
            for c in api_calls[:5]:
                print(f"     {c['url'][:120]}")

        # Show first few rows
        rows = app_state.get('rows', [])
        if rows:
            print(f"\n   Sample data ({min(5, len(rows))} rows):")
            for r in rows[:5]:
                print(f"     {r[:120]}")

        browser.close()
        print("\nDone. Chrome closed.")

if __name__ == "__main__":
    try:
        run()
    except ImportError as e:
        print(f"ERROR: Missing dependency — {e}")
        print()
        print("Run this to install:")
        print("  pip install playwright beautifulsoup4 requests")
        print("  python -m playwright install chromium")
    except Exception as e:
        print(f"ERROR: {e}")
        print()
        print("Tips:")
        print("  - Close ALL Chrome windows before running")
        print("  - Make sure you're logged into Procore in Chrome")
        print("  - Run: python procore_sync.py")