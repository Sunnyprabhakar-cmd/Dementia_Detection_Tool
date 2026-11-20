/**
 * Lightweight in-memory sliding-window rate limiter for Express routes.
 */
export const createRateLimiter = ({ windowMs = 60_000, max = 30, message = "Too many requests, please try again later." } = {}) => {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;
    const recent = (hits.get(key) || []).filter((ts) => ts > windowStart);

    if (recent.length >= max) {
      return res.status(429).json({ message });
    }

    recent.push(now);
    hits.set(key, recent);
    return next();
  };
};

export const securityHeadersMiddleware = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return next();
};
