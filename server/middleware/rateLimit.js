/**
 * Minimal fixed-window rate limiter.
 * The client IP is used only as an in-memory key for the current window:
 * it is never written to disk or to logs.
 * @param {{ windowMs?: number, max?: number }} [options]
 */
function createRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  const hits = new Map();

  // Drop expired windows so memory stays bounded.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  sweep.unref();

  function rateLimit(req, res, next) {
    const now = Date.now();
    let entry = hits.get(req.ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(req.ip, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests' });
    }
    return next();
  }

  rateLimit.reset = () => hits.clear();
  return rateLimit;
}

module.exports = { createRateLimiter };
