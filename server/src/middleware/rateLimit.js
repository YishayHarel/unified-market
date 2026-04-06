const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 120;

const buckets = new Map();

function getClientId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown-client";
}

export function checkRateLimit(req, res, next) {
  const clientId = getClientId(req);
  const now = Date.now();
  const bucket = buckets.get(clientId);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(clientId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfterSec,
    });
  }

  bucket.count += 1;
  buckets.set(clientId, bucket);
  return next();
}
