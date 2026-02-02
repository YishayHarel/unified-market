// Shared CORS configuration for all edge functions

// Production domains
const PRODUCTION_ORIGINS = [
  'https://unified-market.vercel.app',
];

// Local development origins
const LOCAL_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Checks if origin is allowed (production, preview, or local)
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check exact production matches
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  
  // Check local development
  if (LOCAL_ORIGINS.includes(origin)) return true;
  
  // Allow Vercel preview deployments
  if (origin.endsWith('.vercel.app')) {
    return true;
  }
  
  return false;
}

// Returns CORS headers for the request
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : PRODUCTION_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin!,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Handles CORS preflight request
export function handleCorsPreflightRequest(origin: string | null): Response {
  return new Response(null, { 
    status: 204,
    headers: getCorsHeaders(origin) 
  });
}

// Gets safe return URL for redirects (Stripe, etc.)
export function getReturnUrl(origin: string | null, path: string = '/'): string {
  if (origin && isAllowedOrigin(origin)) {
    return `${origin}${path}`;
  }
  return `${PRODUCTION_ORIGINS[0]}${path}`;
}
