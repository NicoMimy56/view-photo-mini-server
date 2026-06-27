const { LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS } = require("../config");

const buckets = new Map();

function getClientKey(req) {
  return req.ip || req.headers["x-forwarded-for"] || "unknown";
}

function loginRateLimit(req, res, next) {
  const key = getClientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS };
    buckets.set(key, bucket);
  }

  if (bucket.count >= LOGIN_RATE_LIMIT_MAX) {
    const retrySec = Math.ceil((bucket.resetAt - now) / 1000);
    return res.status(429).json({
      error: "rate_limited",
      message: `Too many attempts. Try again in ${retrySec} seconds.`
    });
  }

  bucket.count += 1;
  next();
}

module.exports = { loginRateLimit };
