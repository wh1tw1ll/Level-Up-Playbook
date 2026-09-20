// js/core/store.js — Centralized reactive state store
// Pub/sub pattern: subscribe to changes, dispatch updates
// Backbone for all Playbook modules

const listeners = {};
const state = {
  authed: false,
  user: null,
  activeView: 'home',
  sidePanelOpen: false,
  sidePanelTab: 'briefing',
  data: {},        // loaded datasets (contracts, financials, etc.)
  calendar: [],
  flaggedEmails: [],
  chatHistory: [],
  loading: {},
  errors: {}
};

function emit(event, data) {
  if (!listeners[event]) return;
  for (const fn of listeners[event]) {
    try { fn(data); } catch (e) { console.error('Store listener error:', e); }
  }
}

export const store = {
  /** Get current state (shallow copy) */
  get() { return { ...state }; },

  /** Get a specific key */
  getKey(key) { return state[key]; },

  /** Update a key and emit change */
  set(key, value) {
    const old = state[key];
    state[key] = value;
    if (old !== value) {
      emit(key, value);
      emit('*', { key, value });
    }
  },

  /** Subscribe to changes on a specific key or '*' for all */
  on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return () => {
      listeners[event] = listeners[event].filter(f => f !== fn);
    };
  },

  /** Subscribe to a single change, then unsubscribe */
  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      listeners[event] = listeners[event].filter(f => f !== wrapper);
    };
    return this.on(event, wrapper);
  },

  /** Clear all listeners (for testing / reset) */
  clear() {
    Object.keys(listeners).forEach(k => delete listeners[k]);
  }
};

export default store;