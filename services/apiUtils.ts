/**
 * Shared API utilities for Cloudflare Workers & Dev Server
 */

// In-memory sliding window rate limiter
const ipRequestHistory = new Map<string, { count: number; resetTime: number }>();

/**
 * Basic rate limit check: defaults to 40 requests per 60 seconds per IP
 */
export function checkRateLimit(
  request: Request,
  limit = 40,
  windowMs = 60_000
): { allowed: boolean; remaining: number } {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous-client';

  const now = Date.now();
  const current = ipRequestHistory.get(ip);

  if (!current || now > current.resetTime) {
    ipRequestHistory.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count };
}

/**
 * Standard CORS headers for Cloudflare / Web APIs
 */
export function corsHeaders(origin = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-gemini-api-key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * JSON response helper with CORS headers
 */
export function jsonResponse(
  data: any,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

/**
 * Normalized error response with proper status codes (e.g. 401 for missing key)
 */
export function errorResponse(error: any, fallbackStatus = 500): Response {
  const message =
    error?.message || (typeof error === 'string' ? error : 'Internal Server Error');

  let status = fallbackStatus;
  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('api key is missing') ||
    lowerMsg.includes('no gemini api key') ||
    lowerMsg.includes('api_key_invalid') ||
    error?.status === 401
  ) {
    status = 401;
  } else if (lowerMsg.includes('rate limit') || error?.status === 429) {
    status = 429;
  } else if (error?.status === 400 || lowerMsg.includes('missing required fields')) {
    status = 400;
  }

  return jsonResponse({ message, error: message }, status);
}
