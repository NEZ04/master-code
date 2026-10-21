// Small in-memory fixed-window rate limiter, keyed per user (or IP when logged out).
// Fine for one API instance; several instances would share counters in Redis instead.
export function rateLimit({ windowMs, max, name }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.user?._id?.toString() || req.ip;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: `too many ${name} requests, try again in ${retryAfter}s` });
    }
    entry.count++;
    next();
  };
}
