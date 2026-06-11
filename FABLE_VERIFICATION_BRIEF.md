# Fable Verification Brief — Phase 0 + Known Issues

## Overview
Phase 0 foundation (5 sub-items) is deployed at https://level-up-playbook.vercel.app. Everything works but there are 3 issues to verify/fix.

---

## Priority 1: Flagged emails don't appear in Action Items

### Symptoms
- User flags emails in Outlook (both Level Up and MFP accounts)
- The Briefing panel's Actions tab shows empty for flagged emails
- Side panel stays empty

### Current State
**Backend** (`/api/outlook/flagged` at `lib/handlers/flagged.js`):
- Requires Microsoft OAuth sign-in (returns 401 without `lu_auth` cookie)
- Queries Graph API: `me/messages?$filter=flag/flagStatus eq 'flagged' or importance eq 'high'`
- Merges with MFP stored data (from local COM script)
- Returns `{ value: [...], actions: [...], graph_count, stored_count, total }`

**Frontend** (`app.js` line 2199):
- Uses synchronous XHR (`false` param — deprecated in modern browsers)
- Expects `fd.actions` in response (line 2204)
- Silently swallows errors — if XHR fails, `flaggedEmails` stays `[]`

### Root Causes Identified
1. **Auth required** — no flagged data without Microsoft sign-in
2. **MFP cross-tenant** — user's MFP mailbox is in different Azure tenant; Graph API cross-tenant blocked
3. **Workaround for MFP**: local Outlook COM script (`scripts/outlook_flags.py`) needs `pip install pywin32 requests` then cron job
4. **Synchronous XHR** — will be deprecated; should be async fetch

### Key Files
- `lib/handlers/flagged.js` — backend handler (recently fixed `actions` alias)
- `app.js` ~line 2199 — client-side fetch
- `lib/handlers/flagged-store.js` — POST endpoint for local script data
- `scripts/outlook_flags.py` — local COM script (not yet installed)

### Questions for Fable
1. Is the `flag/flagStatus eq 'flagged'` Graph API filter the correct way to get all flagged emails? Or should we query a different endpoint?
2. Is there a better approach for cross-tenant mailbox access without delegate permissions?
3. Should we build a fallback that shows Outlook category "Follow Up" items too?
4. Is the synchronous XHR pattern safe to keep, or should we refactor to async fetch?

---

## Priority 2: Nav tabs delayed/unresponsive on first click

### Symptoms
- Clicking PLAYBOOK, PROJECTS, or ACTION ITEMS tabs
- First click sometimes doesn't register
- Tabs respond after a delay or second click

### Current State
Nav tabs use inline HTML `onclick` handlers:
```html
<button onclick="setView('playbook')">Playbook</button>
```

The `setView()` function (app.js line 255) is defined globally and should be available immediately since app.js is a synchronous `<script>` tag.

### Root Cause Identified
**Password overlay is covering the nav on page load.**

CSS at `styles.css`:
```css
.password-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;            /* ALWAYS visible */
  ...
}
.password-overlay.open { display: flex; }  /* no change */
```

The base rule has `display: flex` — the overlay is ALWAYS rendered and covers the entire viewport at `z-index: 10000`. The ONLY thing hiding it is JavaScript calling `overlay.style.display = 'none'` AFTER the async auth check completes.

Timeline:
1. Page loads → overlay is `display: flex`, covering everything
2. `init()` runs → calls `checkAuthFromCookie()` (sync check for `lu_session` cookie)
3. If no cookie → `tryRefresh()` → async fetch to `/auth/me` or `/api/check-auth`
4. Between steps 2-3, the overlay is visible and blocking clicks
5. User clicks a nav tab → click hits the overlay, not the button
6. Eventually auth resolves → overlay hidden via `style.display = 'none'`

### Fix Needed
The `.password-overlay` base rule should have `display: none` by default, with `.open` adding `display: flex`:

```css
.password-overlay {
  display: none;            /* hidden by default */
}
.password-overlay.open {
  display: flex;            /* only shown when open class is present */
}
```

This way the overlay only covers the screen when the password gate is actively shown, not during the auth check window.

---

## Priority 3: Verify API consolidation stability

### What Changed
11 separate Vercel Serverless Functions → 1 catch-all `api/index.js` with `"/api/(.*)" → "/api/"` rewrite.

### Risk Areas
1. **Query parameters** — verify all endpoints receive query params correctly through the rewrite
2. **POST body parsing** — `chat.js` and `verify-password.js` need `req.body` populated
3. **CORS headers** — some endpoints use per-endpoint origins, catch-all should preserve this
4. **OAuth redirect flow** — `/auth/login` → `/api/oauth?provider=microsoft&action=login` → 302 redirect to Microsoft. The `msMeHandler` uses `parseCookies` from `lib/auth.js` (changed from inline parsing)
5. **Cold start** — single function warms faster than 11 separate, but verify no cross-request state leaks (the `flagged-store.js` in-memory store doesn't persist across cold starts — same behavior as before)

### Files to Review
- `api/index.js` — the catch-all router
- `lib/auth.js` — shared auth utilities (replaced 8 copies of same code)
- `lib/handlers/oauth.js` — refactored from 475-line monster
- `vercel.json` — rewritten routes

---

## All Phase 0 Deliverables

| Item | Status | Notes |
|------|--------|-------|
| 0.1 API consolidation | ✅ Deployed | 11→1 function, shared auth in lib/ |
| 0.2 ES module skeleton | ✅ Deployed | store, settings, api, cache as `window.LU.*` |
| 0.3 Lazy JSON loading | ✅ Deployed | 9 datasets loaded on demand via data.js |
| 0.4 CacheManager + badges | ✅ Deployed | Freshness dots on nav tabs, 30s updates |
| 0.5 Command palette | ✅ Deployed | Ctrl+K omnibar, 14 commands, live search |

### Verify Deployed
https://level-up-playbook.vercel.app

Test:
- `Ctrl+K` opens command palette
- Search filters results
- Theme toggle works
- Nav tabs work on first click (after overlay fix)
- `/api/check-auth` returns `{"authed": false}` without cookies
- `/api/chat` responds to POST with messages
- `/api/outlook/flagged` returns 401 when not authenticated