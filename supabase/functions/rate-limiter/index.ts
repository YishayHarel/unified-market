// Rate Limiter - Simple in-memory rate limiting service

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimit>();

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173'
];

// Returns CORS headers based on origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o.replace(/\/$/, ''))) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Checks rate limit for identifier, creates new window if expired
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000
): { allowed: boolean; resetTime: number; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);

  // Create new window if none exists or expired
  if (!limit || now > limit.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, resetTime: now + windowMs, remaining: maxRequests - 1 };
  }

  // Check if limit exceeded
  if (limit.count >= maxRequests) {
    return { allowed: false, resetTime: limit.resetTime, remaining: 0 };
  }

  // Increment and return
  limit.count++;
  rateLimits.set(identifier, limit);
  return { allowed: true, resetTime: limit.resetTime, remaining: maxRequests - limit.count };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier, maxRequests, windowMs } = await req.json();
    
    if (!identifier) {
      return new Response(JSON.stringify({ error: 'Identifier is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = checkRateLimit(identifier, maxRequests, windowMs);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.allowed ? 200 : 429,
    });
  } catch (error) {
    console.error('Error in rate limiter:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
