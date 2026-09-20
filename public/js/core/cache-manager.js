// js/core/cache-manager.js — Data freshness tracker with sync badges
// Monitors when datasets were last fetched, emits stale/fresh events,
// and provides a refresh mechanism for API data.

import store from './store.js';
import api from './api.js';
import cache from './cache.js';

const FRESHNESS_TTL = {
  calendar:      5 * 60 * 1000,   // 5 min
  flagged:       2 * 60 * 1000,   // 2 min
  actionItems:   5 * 60 * 1000,
  emails:        5 * 60 * 1000,
  procore:       30 * 60 * 1000,  // 30 min
  financials:    60 * 60 * 1000,  // 1 hour
  contracts:     60 * 60 * 1000,
};

const _timestamps = {};

function now() { return Date.now(); }

function age(name) {
  const ts = _timestamps[name];
  return ts ? now() - ts : Infinity;
}

function isFresh(name) {
  return age(name) < (FRESHNESS_TTL[name] || FRESHNESS_TTL.financials);
}

function formatAge(ms) {
  if (ms === Infinity) return 'never';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function touch(name) {
  _timestamps[name] = now();
  store.set(`fresh.${name}`, {
    loadedAt: now(),
    age: 0,
    fresh: true,
    label: 'just now'
  });
  updateBadges();
}

function updateBadges() {
  const badges = {};
  for (const key of Object.keys(FRESHNESS_TTL)) {
    badges[key] = {
      fresh: isFresh(key),
      age: age(key),
      label: formatAge(age(key))
    };
  }
  store.set('syncBadges', badges);
}

// Auto-refresh intervals
let _intervals = [];

function startAutoRefresh(name, intervalMs, fetcher) {
  const id = setInterval(async () => {
    try {
      const data = await fetcher();
      touch(name);
      store.set(name, data);
    } catch (e) {
      console.warn(`Auto-refresh ${name} failed:`, e.message);
    }
  }, intervalMs);
  _intervals.push(id);
  return id;
}

export const cacheManager = {
  /** Touch a dataset (mark as recently loaded) */
  touch(name) { touch(name); },

  /** Get age of a dataset in ms */
  age(name) { return age(name); },

  /** Check if dataset is still fresh */
  isFresh(name) { return isFresh(name); },

  /** Format age as human-readable string */
  formatAge(ms) { return formatAge(ms); },

  /** Get all badge states */
  badges() {
    const b = {};
    for (const key of Object.keys(FRESHNESS_TTL)) {
      b[key] = { fresh: isFresh(key), age: age(key), label: formatAge(age(key)) };
    }
    return b;
  },

  /**
   * Register a dataset for auto-refresh.
   * intervalMs: how often to poll (default: FRESHNESS_TTL * 0.5)
   * fetcher: async function that returns fresh data
   */
  autoRefresh(name, fetcher, intervalMs) {
    const ttl = FRESHNESS_TTL[name] || 5 * 60 * 1000;
    return startAutoRefresh(name, intervalMs || Math.floor(ttl * 0.5), fetcher);
  },

  /** Stop all auto-refresh intervals */
  stopAll() {
    _intervals.forEach(clearInterval);
    _intervals = [];
  },

  /** Force-refresh a single dataset */
  async refresh(name, fetcher) {
    try {
      const data = await fetcher();
      touch(name);
      store.set(name, data);
      return data;
    } catch (e) {
      store.set(`errors.${name}`, e.message);
      throw e;
    }
  },

  /** Initialize default auto-refresh loops */
  init() {
    updateBadges();
    // Update badge display every 30s
    _intervals.push(setInterval(updateBadges, 30000));
  }
};

export default cacheManager;