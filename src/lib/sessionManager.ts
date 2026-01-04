/**
 * Session management utilities
 * Handles session timeout, refresh, and activity tracking
 */

import { supabase } from '@/integrations/supabase/client';

// Session configuration
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const SESSION_WARNING_MS = 5 * 60 * 1000; // Warn 5 minutes before expiry
const ACTIVITY_DEBOUNCE_MS = 60 * 1000; // Debounce activity updates to 1 minute
const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // Refresh session every 10 minutes

let lastActivityTime = Date.now();
let sessionTimeoutId: number | null = null;
let warningTimeoutId: number | null = null;
let refreshIntervalId: number | null = null;
let lastActivityUpdate = 0;
let onSessionExpiredCallback: (() => void) | null = null;
let onSessionWarningCallback: ((remainingMs: number) => void) | null = null;

/**
 * Update last activity timestamp
 * Debounced to prevent excessive updates
 */
export function updateActivity(): void {
  const now = Date.now();
  if (now - lastActivityUpdate < ACTIVITY_DEBOUNCE_MS) return;
  
  lastActivityTime = now;
  lastActivityUpdate = now;
  
  // Store in localStorage for cross-tab sync
  try {
    localStorage.setItem('lastActivityTime', now.toString());
  } catch {
    // localStorage might be unavailable
  }
  
  // Reset timeout timers
  resetSessionTimers();
}

/**
 * Reset session timeout timers
 */
function resetSessionTimers(): void {
  // Clear existing timers
  if (sessionTimeoutId) {
    window.clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
  if (warningTimeoutId) {
    window.clearTimeout(warningTimeoutId);
    warningTimeoutId = null;
  }
  
  // Set warning timer
  warningTimeoutId = window.setTimeout(() => {
    const remainingMs = SESSION_TIMEOUT_MS - SESSION_WARNING_MS;
    if (onSessionWarningCallback) {
      onSessionWarningCallback(remainingMs);
    }
  }, SESSION_TIMEOUT_MS - SESSION_WARNING_MS);
  
  // Set expiry timer
  sessionTimeoutId = window.setTimeout(() => {
    handleSessionExpired();
  }, SESSION_TIMEOUT_MS);
}

/**
 * Handle session expiration
 */
async function handleSessionExpired(): Promise<void> {
  console.log('[SessionManager] Session expired due to inactivity');
  
  // Clear session
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('[SessionManager] Error signing out:', error);
  }
  
  if (onSessionExpiredCallback) {
    onSessionExpiredCallback();
  }
}

/**
 * Refresh the session token proactively
 */
async function refreshSession(): Promise<void> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('[SessionManager] Error refreshing session:', error);
      // If refresh fails, session might be invalid
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        handleSessionExpired();
      }
    } else if (data.session) {
      console.log('[SessionManager] Session refreshed successfully');
    }
  } catch (error) {
    console.error('[SessionManager] Exception refreshing session:', error);
  }
}

/**
 * Initialize session manager
 */
export function initSessionManager(options: {
  onSessionExpired?: () => void;
  onSessionWarning?: (remainingMs: number) => void;
}): void {
  onSessionExpiredCallback = options.onSessionExpired || null;
  onSessionWarningCallback = options.onSessionWarning || null;
  
  // Track user activity
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
  events.forEach(event => {
    window.addEventListener(event, updateActivity, { passive: true });
  });
  
  // Sync activity across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'lastActivityTime' && e.newValue) {
      const storedTime = parseInt(e.newValue, 10);
      if (storedTime > lastActivityTime) {
        lastActivityTime = storedTime;
        resetSessionTimers();
      }
    }
  });
  
  // Check for existing activity time
  try {
    const storedTime = localStorage.getItem('lastActivityTime');
    if (storedTime) {
      const parsedTime = parseInt(storedTime, 10);
      const elapsed = Date.now() - parsedTime;
      
      // If too much time has passed, consider session expired
      if (elapsed > SESSION_TIMEOUT_MS) {
        handleSessionExpired();
        return;
      }
      
      lastActivityTime = parsedTime;
    }
  } catch {
    // localStorage unavailable
  }
  
  // Start session refresh interval
  refreshIntervalId = window.setInterval(refreshSession, SESSION_REFRESH_INTERVAL_MS);
  
  // Initial session refresh
  refreshSession();
  
  // Start timeout timers
  resetSessionTimers();
  
  console.log('[SessionManager] Initialized with 30-minute timeout');
}

/**
 * Cleanup session manager
 */
export function cleanupSessionManager(): void {
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
  events.forEach(event => {
    window.removeEventListener(event, updateActivity);
  });
  
  if (sessionTimeoutId) {
    window.clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
  if (warningTimeoutId) {
    window.clearTimeout(warningTimeoutId);
    warningTimeoutId = null;
  }
  if (refreshIntervalId) {
    window.clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
  
  onSessionExpiredCallback = null;
  onSessionWarningCallback = null;
}

/**
 * Extend session (reset timeout)
 */
export function extendSession(): void {
  updateActivity();
  refreshSession();
}

/**
 * Get remaining session time
 */
export function getRemainingSessionTime(): number {
  const elapsed = Date.now() - lastActivityTime;
  return Math.max(0, SESSION_TIMEOUT_MS - elapsed);
}

/**
 * Check if session is active
 */
export function isSessionActive(): boolean {
  return getRemainingSessionTime() > 0;
}
