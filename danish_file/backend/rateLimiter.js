// ---------------------------------------------------------
// rateLimiter.js
// API management feature 2: RATE LIMITING
//
// Limits how many requests one IP address may send in a
// period of time. When the limit is passed, the API answers
// 429 Too Many Requests until the period ends.
//
// Usage:
//   const limiter = createRateLimiter({
//     windowMs: 15 * 60 * 1000,   // length of the period
//     max: 300,                   // requests allowed in it
//     message: "Too many requests."
//   });
//   app.use("/api", limiter);
//
// The counts are kept in memory, which suits one server.
// ---------------------------------------------------------

function createRateLimiter(options) {
  const windowMs = options.windowMs;
  const max = options.max;
  const message = options.message || "Too many requests. Please try again later.";

  // true = only requests that FAIL (status 400 or above) are counted.
  // Used for login, so that correct logins never lock a user out
  // but repeated wrong passwords do.
  const countOnlyFailures = options.countOnlyFailures === true;

  // IP address -> { count, resetAt }
  const visitors = new Map();

  // Remove finished periods once a minute so the Map stays small
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of visitors) {
      if (record.resetAt <= now) {
        visitors.delete(ip);
      }
    }
  }, 60 * 1000);
  cleaner.unref(); // do not keep the server alive just for this timer

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const ip = req.ip;

    let record = visitors.get(ip);

    // First request from this IP, or its previous period has ended
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs };
      visitors.set(ip, record);
    }

    const secondsLeft = Math.ceil((record.resetAt - now) / 1000);

    // Tell the client its limit, like well-known public APIs do
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Reset", secondsLeft);

    if (record.count >= max) {
      res.setHeader("RateLimit-Remaining", 0);
      res.setHeader("Retry-After", secondsLeft);

      return res.status(429).json({
        success: false,
        message: message,
        retry_after_seconds: secondsLeft
      });
    }

    record.count += 1;
    res.setHeader("RateLimit-Remaining", Math.max(0, max - record.count));

    if (countOnlyFailures) {
      // Give the attempt back when the request turned out fine
      res.on("finish", () => {
        if (res.statusCode < 400 && record.count > 0) {
          record.count -= 1;
        }
      });
    }

    next();
  };
}

module.exports = createRateLimiter;
