// AI Stock Advisor - Provides AI-powered stock insights (currently disabled)

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Rate limiting storage
interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimit>();

// Checks rate limit for identifier
function checkRateLimit(
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

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Feature disabled - return coming soon message
  console.log('AI Stock Advisor - Feature disabled, returning coming soon message');
  
  return new Response(
    JSON.stringify({ 
      error: "YishAI is coming soon! This feature will be available shortly with personalized stock market insights and AI-powered analysis.",
      comingSoon: true
    }),
    {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
