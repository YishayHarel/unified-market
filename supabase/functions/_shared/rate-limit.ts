// Shared rate limiting utility for edge functions

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Global rate limit storage (shared across requests within same instance)
const rateLimits = new Map<string, RateLimitEntry>();

// Cleanup tracking
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Removes expired entries periodically to prevent memory bloat
function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetTime) {
      rateLimits.delete(key);
    }
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterMs?: number;
}

// Preset configurations for different use cases
export const RATE_LIMIT_TIERS = {
  authenticated: { maxRequests: 100, windowMs: 60 * 1000 },
  anonymous: { maxRequests: 30, windowMs: 60 * 1000 },
  ai: { maxRequests: 10, windowMs: 60 * 1000 },
  data: { maxRequests: 60, windowMs: 60 * 1000 },
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
} as const;

// Checks rate limit for identifier, returns allowed status and remaining
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_TIERS.authenticated
): RateLimitResult {
  cleanupExpiredEntries();
  
  const now = Date.now();
  const entry = rateLimits.get(identifier);
  
  // No entry or expired - create new window
  if (!entry || now > entry.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfterMs: entry.resetTime - now
    };
  }
  
  // Increment and return
  entry.count++;
  rateLimits.set(identifier, entry);
  return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

// Gets client identifier from request headers
export function getClientIdentifier(req: Request): string {
  // Try X-Forwarded-For first (most reliable for proxied requests)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try X-Real-IP
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  
  // Try CF-Connecting-IP (Cloudflare)
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  
  // Fallback to hash of user agent + origin
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const origin = req.headers.get('origin') || 'unknown';
  return `fallback:${hashString(userAgent + origin)}`;
}

// Simple string hash for fallback identification
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Creates rate limit response headers
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.remaining.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
    ...(result.retryAfterMs ? { 'Retry-After': Math.ceil(result.retryAfterMs / 1000).toString() } : {})
  };
}

// Creates a 429 rate limit exceeded response
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfterMs: result.retryAfterMs,
      resetTime: result.resetTime
    }),
    {
      status: 429,
      headers: { ...corsHeaders, ...getRateLimitHeaders(result), 'Content-Type': 'application/json' }
    }
  );
}
