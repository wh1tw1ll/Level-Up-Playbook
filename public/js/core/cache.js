// js/core/cache.js — Client-side response cache with TTL
// Reduces redundant API calls and speeds up repeat view loads

const _cache = new Map();

const DEFAULTS = {
  ttl: 5 * 60 * 1000,   // 5 minutes default
  maxEntries: 50
};

export const cache = {
  /** Get cached value if still fresh */
  get(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      _cache.delete(key);
      return null;
    }
    return entry.data;
  },

  /** Store a value with optional TTL */
  set(key, data, ttl) {
    if (_cache.size >= DEFAULTS.maxEntries) {
      // Evict oldest entry
      const oldest = _cache.keys().next().value;
      if (oldest) _cache.delete(oldest);
    }
    _cache.set(key, {
      data,
      expiresAt: Date.now() + (ttl || DEFAULTS.ttl),
      storedAt: Date.now()
    });
  },

  /** Check if key exists and is fresh */
  has(key) {
    return this.get(key) !== null;
  },

  /** Invalidate a specific key */
  invalidate(key) {
    _cache.delete(key);
  },

  /** Invalidate all keys matching a prefix */
  invalidatePrefix(prefix) {
    for (const key of _cache.keys()) {
      if (key.startsWith(prefix)) _cache.delete(key);
    }
  },

  /** Clear entire cache */
  clear() {
    _cache.clear();
  },

  /** Get cache stats */
  stats() {
    return {
      size: _cache.size,
      keys: Array.from(_cache.keys()),
      maxEntries: DEFAULTS.maxEntries
    };
  },

  /** Fetch with caching: checks cache first, calls fetcher on miss */
  async memoize(key, fetcher, ttl) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }
};

export default cache;