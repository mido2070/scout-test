import handleAnalyzePolicy from './api/analyze-policy';
import handleAnalyzeZoning from './api/analyze-zoning';
import handleChatAssistant from './api/chat-assistant';
import handleRefinePolicy from './api/refine-policy';
import handleTranslateReport from './api/translate-report';
import { checkRateLimit, corsHeaders, jsonResponse } from './services/apiUtils';

export interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  GEMINI_API_KEY?: string;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight for API routes
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Handle /api/* serverless routes
    if (url.pathname.startsWith('/api/')) {
      // Rate limiting: 40 requests per minute per IP to protect Cloudflare Free limits
      const rateCheck = checkRateLimit(request, 40, 60_000);
      if (!rateCheck.allowed) {
        return jsonResponse(
          {
            message:
              'Rate limit exceeded. Please wait a minute before making more requests.',
          },
          429
        );
      }

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
