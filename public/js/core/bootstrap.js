// js/core/bootstrap.js — System initialization and DI wiring
// Call boot() once at page load to initialize store, settings, data, auth

import store from './store.js';
import settings from './settings.js';
import api from './api.js';
import cache from './cache.js';
import { bootLoader, warm } from './data.js';

let _initialized = false;

async function checkAuth() {
  try {
    const result = await api.checkAuth();
    store.set('authed', result.authed || false);
    if (result.authed) {
      // If authenticated via OAuth, try to get user info
      try {
        const me = await fetch('/auth/me', { credentials: 'include' });
        if (me.ok) {
          const user = await me.json();
          if (user.authenticated) {
            store.set('user', { name: user.name, email: user.email });
          }
        }
      } catch (e) { /* not fatal */ }
    }
  } catch (e) {
    store.set('authed', false);
  }
}

function registerKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+K: search/command palette (future)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      store.set('commandPaletteOpen', true);
    }
    // Escape: close panels
    if (e.key === 'Escape') {
      store.set('commandPaletteOpen', false);
      store.set('sidePanelOpen', false);
    }
  });
}

function wireStoreToDOM() {
  // Listen for store changes that should update localStorage or side effects
  store.on('authed', (val) => {
    document.body.classList.toggle('lu-authed', val);
  });

  store.on('sidePanelOpen', (val) => {
    document.body.classList.toggle('lu-panel-open', val);
  });
}

export async function boot() {
  if (_initialized) return;
  _initialized = true;

  // 1. Initialize store with default state
  store.set('settings', settings.all());
  store.set('_bootTime', Date.now());

  // 2. Wire listeners
  wireStoreToDOM();

  // 3. Check auth state
  await checkAuth();

  // 4. Load initial data (minimum set for render)
  bootLoader().then(results => {
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn('Boot loader: some datasets failed', failed);
    }
    // Warm additional datasets in background
    warm('kb', 'contracts_master', 'contract_terms');
  });

  // 5. Register keyboard shortcuts
  registerKeyboardShortcuts();

  // 6. Mark ready
  store.set('ready', true);

  return { store, settings, api, cache };
}

// Auto-boot on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { boot, store, settings, api, cache };