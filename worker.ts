import handleAnalyzePolicy from './api/analyze-policy';
import handleAnalyzeZoning from './api/analyze-zoning';
import handleChatAssistant from './api/chat-assistant';
import handleRefinePolicy from './api/refine-policy';
import handleTranslateReport from './api/translate-report';
import { authenticateRequest } from './services/firebaseAuthServer';
import { checkEdgeRateLimit, corsHeaders, jsonResponse } from './services/apiUtils';
import { UsageLimiter } from './durable_objects/UsageLimiter';

// Re-export Durable Object class for Cloudflare Wrangler binding
export { UsageLimiter };

export interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  USAGE_LIMITER?: DurableObjectNamespace<UsageLimiter>;
  GEMINI_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  ADMIN_EMAIL?: string;
  GEMINI_MODEL?: string;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight for all API routes
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Handle /api/* serverless routes
    if (url.pathname.startsWith('/api/')) {
      const edgeCheck = checkEdgeRateLimit(request, 60, 60_000);
      if (!edgeCheck.allowed) {
        return jsonResponse(
          { message: 'Rate limit exceeded. Please wait a minute before sending more requests.' },
          429
        );
      }

      // Quota check endpoint (allows frontend to display live remaining daily usage)
      if (url.pathname === '/api/usage-status') {
        try {
          let userId = 'anonymous';
          try {
            const user = await authenticateRequest(request, env);
            userId = user.uid;
          } catch {
            // Unauthenticated visitor: return default baseline status
            return jsonResponse({
              allowed: true,
              status: 200,
              userRemaining: 3,
              globalRemaining: 30,
              dateUtc: new Date().toISOString().split('T')[0],
              authenticated: false,
            });
          }

          if (!env.USAGE_LIMITER) {
            return jsonResponse(
              {
                message: 'AI capacity coordinator is temporarily unavailable (Missing USAGE_LIMITER binding).',
                allowed: false,
                status: 503,
              },
              503
            );
          }

          const id = env.USAGE_LIMITER.idFromName('global-coordinator');
          const limiter = env.USAGE_LIMITER.get(id);
          const status = await limiter.getUserQuotaStatus(userId);
          return jsonResponse({ ...status, authenticated: true });
        } catch (error: any) {
          return jsonResponse({ message: error?.message || 'Quota service error' }, 500);
        }
      }

      // Admin stats endpoint (requires verified admin identity)
      if (url.pathname === '/api/admin/usage') {
        try {
          const user = await authenticateRequest(request, env);
          const adminEmail = (env.ADMIN_EMAIL || 'mahmedzsayed@gmail.com').toLowerCase().trim();
          
          if (!user.email || user.email.toLowerCase().trim() !== adminEmail) {
            return jsonResponse({ message: 'Forbidden. Admin privileges required.' }, 403);
          }

          if (!env.USAGE_LIMITER) {
            return jsonResponse({ message: 'Missing USAGE_LIMITER binding.' }, 503);
          }

          const id = env.USAGE_LIMITER.idFromName('global-coordinator');
          const limiter = env.USAGE_LIMITER.get(id);
          const stats = await limiter.getAdminStats();
          return jsonResponse(stats);
        } catch (error: any) {
          return jsonResponse({ message: error?.message || 'Unauthorized' }, 401);
        }
      }

      // Admin emergency kill-switch endpoint
      if (url.pathname === '/api/admin/kill-switch' && request.method === 'POST') {
        try {
          const user = await authenticateRequest(request, env);
          const adminEmail = (env.ADMIN_EMAIL || 'mahmedzsayed@gmail.com').toLowerCase().trim();
          
          if (!user.email || user.email.toLowerCase().trim() !== adminEmail) {
            return jsonResponse({ message: 'Forbidden. Admin privileges required.' }, 403);
          }

          if (!env.USAGE_LIMITER) {
            return jsonResponse({ message: 'Missing USAGE_LIMITER binding.' }, 503);
          }

          const body = (await request.json()) as any;
          const disabled = Boolean(body?.disabled);

          const id = env.USAGE_LIMITER.idFromName('global-coordinator');
          const limiter = env.USAGE_LIMITER.get(id);
          await limiter.setKillSwitch(disabled);

          return jsonResponse({ success: true, aiDisabled: disabled });
        } catch (error: any) {
          return jsonResponse({ message: error?.message || 'Unauthorized' }, 401);
        }
      }

      // AI Endpoints (Protected by Firebase Auth, Turnstile, and Durable Object Quota)
      switch (url.pathname) {
        case '/api/analyze-policy':
          return handleAnalyzePolicy(request, env);
        case '/api/analyze-zoning':
          return handleAnalyzeZoning(request, env);
        case '/api/chat-assistant':
          return handleChatAssistant(request, env);
        case '/api/refine-policy':
          return handleRefinePolicy(request, env);
        case '/api/translate-report':
          return handleTranslateReport(request, env);
        default:
          return jsonResponse(
            { message: `Endpoint not found: ${url.pathname}` },
            404
          );
      }
    }

    // Serve static SPA frontend assets using Cloudflare Workers Assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
