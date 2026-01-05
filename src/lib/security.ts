import { z } from 'zod';

// ============================================
// INPUT SANITIZATION - Protect against XSS/Injection
// ============================================

/**
 * Remove potentially dangerous HTML/script content
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Sanitize user input for general text fields
 */
export function sanitizeText(input: string, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
}

/**
 * Sanitize input that will be used in SQL-like contexts (defense in depth)
 * Note: Supabase uses parameterized queries, but this provides additional safety
 */
export function sanitizeSqlInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/'/g, "''")
    .replace(/--/g, '')
    .replace(/;/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/union\s+select/gi, '')
    .replace(/insert\s+into/gi, '')
    .replace(/drop\s+table/gi, '')
    .replace(/delete\s+from/gi, '')
    .trim()
    .slice(0, 500);
}

/**
 * Validate and sanitize URL parameters
 */
export function sanitizeUrlParam(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return encodeURIComponent(
    input
      .trim()
      .replace(/[<>'"]/g, '')
      .slice(0, 100)
  );
}

// ============================================
// VALIDATION SCHEMAS - Common patterns
// ============================================

export const uuidSchema = z.string().uuid({ message: "Invalid ID format" });

export const displayNameSchema = z
  .string()
  .min(1, { message: "Display name is required" })
  .max(50, { message: "Display name must be less than 50 characters" })
  .regex(/^[a-zA-Z0-9\s_-]+$/, { message: "Display name can only contain letters, numbers, spaces, underscores, and hyphens" })
  .transform(val => sanitizeText(val, 50));

export const contentSchema = z
  .string()
  .min(1, { message: "Content is required" })
  .max(10000, { message: "Content must be less than 10,000 characters" })
  .transform(val => sanitizeText(val, 10000));

export const titleSchema = z
  .string()
  .min(1, { message: "Title is required" })
  .max(200, { message: "Title must be less than 200 characters" })
  .transform(val => sanitizeText(val, 200));

export const priceSchema = z
  .number()
  .positive({ message: "Price must be positive" })
  .max(1000000000, { message: "Price is too large" });

export const quantitySchema = z
  .number()
  .int({ message: "Quantity must be a whole number" })
  .positive({ message: "Quantity must be positive" })
  .max(1000000, { message: "Quantity is too large" });

// ============================================
// ERROR HANDLING - Safe error messages
// ============================================

interface SafeError {
  message: string;
  code: string;
  isOperational: boolean;
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function createSafeError(error: unknown): SafeError {
  // Known operational errors that are safe to show to users
  const operationalErrors: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password',
    'Email not confirmed': 'Please verify your email address',
    'User already registered': 'An account with this email already exists',
    'Password should be at least': 'Password does not meet requirements',
    'Rate limit exceeded': 'Too many requests. Please try again later',
    'Network request failed': 'Connection error. Please check your internet',
    'JWT expired': 'Your session has expired. Please sign in again',
    'Invalid token': 'Your session is invalid. Please sign in again',
  };

  if (error instanceof Error) {
    // Check if it's a known operational error
    for (const [pattern, safeMessage] of Object.entries(operationalErrors)) {
      if (error.message.includes(pattern)) {
        return {
          message: safeMessage,
          code: 'OPERATIONAL_ERROR',
          isOperational: true,
        };
      }
    }

    // Log full error for debugging, but return safe message
    console.error('[Security] Unhandled error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return {
      message: 'An unexpected error occurred. Please try again.',
      code: 'INTERNAL_ERROR',
      isOperational: false,
    };
  }

  // Unknown error type
  console.error('[Security] Unknown error type:', error);
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    isOperational: false,
  };
}

/**
 * Wrap async functions with safe error handling
 */
export function withSafeErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const safeError = createSafeError(error);
      console.error(`[${context}] Error:`, safeError);
      throw new Error(safeError.message);
    }
  }) as T;
}

// ============================================
// BUSINESS LOGIC VALIDATION
// ============================================

/**
 * Validate price ID matches a known tier
 */
export function validatePriceId(priceId: string, validPriceIds: string[]): boolean {
  return validPriceIds.includes(priceId);
}

/**
 * Validate subscription status before granting access
 */
export function validateSubscriptionAccess(
  subscribed: boolean,
  subscriptionEnd: string | null
): boolean {
  if (!subscribed) return false;
  if (!subscriptionEnd) return false;
  
  const endDate = new Date(subscriptionEnd);
  return endDate > new Date();
}

/**
 * Validate numeric input is within reasonable bounds
 */
export function validateNumericBounds(
  value: number,
  min: number,
  max: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }
  if (value < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  if (value > max) {
    return { valid: false, error: `${fieldName} must be at most ${max}` };
  }
  return { valid: true };
}

// ============================================
// REQUEST VALIDATION
// ============================================

/**
 * Validate API request has required fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  data: unknown,
  requiredFields: (keyof T)[]
): { valid: boolean; missing: string[] } {
  if (!data || typeof data !== 'object') {
    return { valid: false, missing: requiredFields as string[] };
  }

  const missing: string[] = [];
  for (const field of requiredFields) {
    if (!(field in data) || (data as T)[field] === undefined || (data as T)[field] === null) {
      missing.push(field as string);
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Rate limit check helper (for frontend awareness)
 */
export function createRateLimitKey(action: string, identifier: string): string {
  return `rate_limit:${action}:${identifier}`;
}
