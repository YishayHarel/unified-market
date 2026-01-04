// Auth rate limiting utility
// Prevents brute force attacks by limiting login attempts

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const authRateLimits = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 5; // Max attempts before lockout
const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minute lockout

/**
 * Check if an identifier (email or IP) is rate limited
 * Returns { allowed: boolean, remainingAttempts: number, lockoutTimeRemaining: number }
 */
export function checkAuthRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  lockoutTimeRemaining: number;
} {
  const now = Date.now();
  const normalizedId = identifier.toLowerCase().trim();
  const entry = authRateLimits.get(normalizedId);

  // No previous attempts
  if (!entry) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockoutTimeRemaining: 0 };
  }

  // Check if locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockoutTimeRemaining: Math.ceil((entry.lockedUntil - now) / 1000 / 60), // minutes
    };
  }

  // Check if window has expired (reset)
  if (now - entry.firstAttempt > WINDOW_MS) {
    authRateLimits.delete(normalizedId);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockoutTimeRemaining: 0 };
  }

  // Within window, check count
  const remaining = MAX_ATTEMPTS - entry.count;
  return {
    allowed: remaining > 0,
    remainingAttempts: Math.max(0, remaining),
    lockoutTimeRemaining: 0,
  };
}

/**
 * Record a failed auth attempt
 */
export function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const normalizedId = identifier.toLowerCase().trim();
  const entry = authRateLimits.get(normalizedId);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    // Start new window
    authRateLimits.set(normalizedId, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return;
  }

  // Increment count
  entry.count++;

  // Check if should lock out
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }

  authRateLimits.set(normalizedId, entry);
}

/**
 * Clear rate limit on successful auth
 */
export function clearRateLimit(identifier: string): void {
  const normalizedId = identifier.toLowerCase().trim();
  authRateLimits.delete(normalizedId);
}

/**
 * Get human-readable message for rate limit status
 */
export function getRateLimitMessage(status: ReturnType<typeof checkAuthRateLimit>): string | null {
  if (status.allowed) {
    if (status.remainingAttempts <= 2 && status.remainingAttempts > 0) {
      return `Warning: ${status.remainingAttempts} attempt(s) remaining before temporary lockout.`;
    }
    return null;
  }

  if (status.lockoutTimeRemaining > 0) {
    return `Too many failed attempts. Please try again in ${status.lockoutTimeRemaining} minute(s).`;
  }

  return 'Too many failed attempts. Please try again later.';
}
