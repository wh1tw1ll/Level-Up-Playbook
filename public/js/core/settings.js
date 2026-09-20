// js/core/settings.js — User preferences management
// Persists to localStorage, provides defaults, emits changes via store

import store from './store.js';

const STORAGE_KEY = 'lu_playbook_settings';

const defaults = {
  theme: 'dark',
  sidebarOpen: true,
  sidebarWidth: 320,
  chatFontSize: 14,
  pinnedTabs: ['home'],
  lastActiveTab: 'home',
  compactMode: false,
  autoRefreshInterval: 30,  // seconds
  collapsedSections: []
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch (e) { /* ignore corrupt storage */ }
  return { ...defaults };
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* storage full or blocked */ }
}

const _settings = load();

export const settings = {
  /** Get all settings */
  all() { return { ..._settings }; },

  /** Get a specific setting */
  get(key) { return _settings[key] !== undefined ? _settings[key] : defaults[key]; },

  /** Update setting(s) and persist */
  set(key, value) {
    if (typeof key === 'object') {
      Object.assign(_settings, key);
      save(_settings);
      for (const k of Object.keys(key)) {
        store.set(`settings.${k}`, key[k]);
      }
    } else {
      _settings[key] = value;
      save(_settings);
      store.set(`settings.${key}`, value);
    }
  },

  /** Reset to defaults */
  reset() {
    Object.assign(_settings, defaults);
    save(_settings);
    store.set('settings', { ...defaults });
  }
};

export default settings;