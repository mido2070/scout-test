import { authenticateRequest, VerifiedUser } from './firebaseAuthServer';
import { verifyTurnstileToken } from './turnstileServer';

export interface ProtectedRequestContext {
  user: VerifiedUser;
  env: any;
  request: Request;
  requestId: string;
}

// In-memory sliding window edge IP rate limiter (first layer of defense)
const ipRequestHistory = new Map<string, { count: number; resetTime: number }>();

export function checkEdgeRateLimit(
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

export function corsHeaders(origin = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, cf-turnstile-response, x-request-id',
    'Access-Control-Max-Age': '86400',
  };
}

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

export function errorResponse(error: any, fallbackStatus = 500): Response {
  const message =
    error?.message || (typeof error === 'string' ? error : 'Internal Server Error');

  let status = fallbackStatus;
  const lowerMsg = message.toLowerCase();

  if (
    lowerMsg.includes('sign in') ||
    lowerMsg.includes('authentication') ||
    lowerMsg.includes('token') ||
    error?.status === 401
  ) {
    status = 401;
  } else if (
    lowerMsg.includes('quota') ||
    lowerMsg.includes('capacity') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('wait') ||
    error?.status === 429
  ) {
    status = 429;
  } else if (lowerMsg.includes('bot verification') || error?.status === 403) {
    status = 403;
  } else if (lowerMsg.includes('paused') || error?.status === 503) {
    status = 503;
  } else if (error?.status === 400 || lowerMsg.includes('missing required fields')) {
    status = 400;
  }

  return jsonResponse({ message, error: message }, status);
}

/**
 * Executes an AI operation with full authentication, Turnstile verification,
 * and atomic Durable Object quota reservation.
 */
export async function executeProtectedAiEndpoint(
  request: Request,
  env: any,
  featureName: string,
  handler: (ctx: ProtectedRequestContext) => Promise<any>
): Promise<Response> {
  const requestId =
    request.headers.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Edge IP flood defense
  const edgeCheck = checkEdgeRateLimit(request, 40, 60_000);
  if (!edgeCheck.allowed) {
    return jsonResponse(
      { message: 'Rate limit exceeded. Please wait a minute before making more requests.' },
      429
    );
  }

  // 2. Strict Firebase Authentication
  let user: VerifiedUser;
  try {
    user = await authenticateRequest(request, env);
  } catch (authError: any) {
    return errorResponse(authError, 401);
  }

  // 3. Bot & Abuse Prevention (Cloudflare Turnstile)
  const turnstileToken =
    request.headers.get('cf-turnstile-response') ||
    request.headers.get('x-turnstile-token');
  const turnstileSecret = env?.TURNSTILE_SECRET_KEY;

  if (turnstileSecret && featureName !== 'chat-assistant') {
    const turnstileResult = await verifyTurnstileToken(turnstileToken, request, turnstileSecret);
    if (!turnstileResult.success) {
      return jsonResponse(
        { message: 'Security check failed. Please refresh the page and verify you are human.' },
        403
      );
    }
  }

  // 4. Centralized Atomic Quota Reservation via Durable Object
  let limiterStub: any = null;
  if (env?.USAGE_LIMITER) {
    try {
      const id = env.USAGE_LIMITER.idFromName('global-coordinator');
      limiterStub = env.USAGE_LIMITER.get(id);

      const reservation = await limiterStub.checkAndReserve(user.uid, featureName, requestId);
      if (!reservation.allowed) {
        return jsonResponse(
          {
            message: reservation.reason || 'Daily free AI capacity reached.',
            retryAfter: reservation.retryAfterSeconds,
          },
          reservation.status || 429
        );
      }
    } catch (quotaError: any) {
      console.error('[QuotaLimiter] Quota coordinator error:', quotaError);
      // Fail closed as required by security guidelines
      return jsonResponse(
        { message: 'AI capacity coordinator is temporarily unavailable. Please try again shortly.' },
        503
      );
    }
  }

  // 5. Execute Gemini AI logic
  let success = false;
  try {
    const result = await handler({ user, env, request, requestId });
    success = true;
    return jsonResponse(result);
  } catch (error: any) {
    console.error(`[API ${featureName}] Execution failed:`, error?.message || error);
    return errorResponse(error);
  } finally {
    // 6. Release lock and update metrics in Durable Object
    if (limiterStub) {
      try {
        await limiterStub.completeRequest(user.uid, featureName, success);
      } catch (err) {
        console.warn('[QuotaLimiter] Failed to record completion:', err);
      }
    }
  }
}
