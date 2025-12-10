import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Rate limiting storage
interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimit>();

/**
 * Simple in-memory rate limiter
 */
function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
): { allowed: boolean; resetTime: number; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);

  if (!limit || now > limit.resetTime) {
    // Create new rate limit window
    rateLimits.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return {
      allowed: true,
      resetTime: now + windowMs,
      remaining: maxRequests - 1
    };
  }

  if (limit.count >= maxRequests) {
    return {
      allowed: false,
      resetTime: limit.resetTime,
      remaining: 0
    };
  }

  // Increment count
  limit.count++;
  rateLimits.set(identifier, limit);

  return {
    allowed: true,
    resetTime: limit.resetTime,
    remaining: maxRequests - limit.count
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // FEATURE DISABLED - Return "coming soon" message for all requests
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