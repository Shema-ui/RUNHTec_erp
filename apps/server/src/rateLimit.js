// Small in-memory rate limiter. The backend runs as a single instance, so
// keeping counters in memory is enough; they reset when the server restarts.

function createLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Drop expired entries now and then so memory stays small.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, Math.min(windowMs, 10 * 60 * 1000)).unref();

  function entryFor(key) {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    return entry;
  }

  return {
    // True when this key has used up its allowance for the current window.
    isBlocked(key) {
      const entry = hits.get(key);
      return Boolean(entry && entry.resetAt > Date.now() && entry.count >= max);
    },
    hit(key) {
      entryFor(key).count += 1;
    },
    reset(key) {
      hits.delete(key);
    },
    retryAfterSeconds(key) {
      const entry = hits.get(key);
      return entry ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 0;
    },
  };
}

module.exports = { createLimiter };
