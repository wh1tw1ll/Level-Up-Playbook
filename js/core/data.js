// js/core/data.js — Lazy JSON data loader with store integration
// Fetches data/*.json files on demand, sets window.__ globals for backward compat,
// and pushes loaded data to the reactive store

import store from './store.js';

const CACHE = new Map();
const PENDING = new Map();

// Map of JSON filenames to their window.__ global names and store keys
const DATASETS = {
  'kb':               { global: '__KB',                storeKey: 'kb' },
  'contracts_kb':     { global: '__CONTRACT_KB',       storeKey: 'contractsKb' },
  'contracts_master': { global: '__MFP_CONTRACTS_MASTER', storeKey: 'contractsMaster' },
  'contract_terms':   { global: '__MFP_CONTRACT_TERMS',   storeKey: 'contractTerms' },
  'mfp_financials':   { global: '__MFP_FINANCIALS',       storeKey: 'financials' },
  'mfp_context':      { global: '__MFP_CONTEXT',          storeKey: 'context' },
  'mfp_cowatchdog':   { global: '__CO_WATCHDOG',          storeKey: 'coWatchdog' },
  'templates':        { global: '__TEMPLATES',            storeKey: 'templates' },
  'checklist':        { global: null,                     storeKey: 'checklist' }
};

export async function load(name) {
  if (CACHE.has(name)) return CACHE.get(name);
  if (PENDING.has(name)) return PENDING.get(name);

  const promise = (async () => {
    const resp = await fetch(`/data/${name}.json`);
    if (!resp.ok) throw new Error(`Dataset ${name}: HTTP ${resp.status}`);
    const data = await resp.json();
    CACHE.set(name, data);

    // Backward compat: set window.__ global
    const ds = DATASETS[name];
    if (ds?.global) {
      try { window[ds.global] = data; } catch (e) { /* no window */ }
    }

    // Push to reactive store
    if (ds?.storeKey) {
      store.set(ds.storeKey, data);
    }

    return data;
  })();

  PENDING.set(name, promise);
  promise.finally(() => PENDING.delete(name));
  return promise;
}

export function getCached(name) {
  return CACHE.get(name) || null;
}

// Preload all known datasets
export function preloadAll() {
  Object.keys(DATASETS).forEach(name => {
    load(name).catch(() => {});
  });
}

// Warm up specific datasets
export function warm(...names) {
  names.forEach(n => load(n).catch(() => {}));
}

// Boot-time loader: loads minimum needed for initial render
export async function bootLoader() {
  const needed = ['mfp_context', 'mfp_financials', 'templates', 'mfp_cowatchdog'];
  const results = await Promise.allSettled(needed.map(n => load(n)));
  return results;
}