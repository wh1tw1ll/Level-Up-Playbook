// js/core/api.js — Unified API client wrapper
// All Playbook API calls go through here: auth, Graph, Procore, chat, data
// Handles credentials, retries, error normalization

const BASE = '';  // relative, same origin

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const config = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  };

  // Don't set Content-Type for GET/HEAD or FormData
  if (!options.body || options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const res = await fetch(url, config);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.status) throw err;  // already an API error
    throw new Error(`Network error: ${err.message}`);
  }
}

export const api = {
  // ─── Auth ───
  checkAuth() {
    return request('/api/check-auth');
  },

  verifyPassword(password) {
    return request('/api/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  // ─── Outlook / Graph ───
  getCalendar(days = 14) {
    return request(`/api/outlook/calendar?days=${days}`);
  },

  getFlaggedEmails(days = 14) {
    return request(`/api/outlook/flagged?days=${days}`);
  },

  getActionItems(days = 21, limit = 100) {
    return request(`/api/outlook/action-items?days=${days}&limit=${limit}`);
  },

  getEmails(limit = 20) {
    return request(`/api/outlook/email?limit=${limit}`);
  },

  // ─── SharePoint ───
  searchSharepoint(query) {
    return request(`/api/sharepoint/search?q=${encodeURIComponent(query)}`);
  },

  readSharepointFile(driveId, itemId) {
    return request(`/api/sharepoint/read?driveId=${driveId}&itemId=${itemId}`);
  },

  // ─── Chat ───
  chat(messages, system) {
    return request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, system })
    });
  },

  // ─── Sync / Data ───
  getStoredFlagged() {
    return request('/api/sync/flagged-store');
  },

  // ─── OAuth ───
  getOAuthUrl(provider, action, params = {}) {
    const qs = new URLSearchParams({ provider, action, ...params });
    return `${BASE}/api/oauth?${qs}`;
  },

  // ─── Procore ───
  getProcoreData(rt) {
    return request(`/procore/data${rt ? `?rt=${rt}` : ''}`);
  },

  discoverProcore(rt) {
    return request(`/procore/discover${rt ? `?rt=${rt}` : ''}`);
  },

  // ─── Data files (lazy JSON) ───
  loadDataset(name) {
    return request(`/data/${name}.json`);
  }
};

export default api;