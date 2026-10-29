import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev middleware so that `npm run dev` in AI Studio or locally
 * serves all /api/* routes directly using the serverless handlers.
 */
function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        try {
          const origin = `http://${req.headers.host || 'localhost:3000'}`;
          const url = new URL(req.url, origin);
          const pathname = url.pathname;

          // Read body stream safely with events
          const bodyText = await new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            req.on('error', (err) => reject(err));
          });

          const webReq = new Request(url.toString(), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : bodyText,
          });

          let response: Response | undefined;
          if (pathname === '/api/usage-status') {
            response = new Response(
              JSON.stringify({
                allowed: true,
                status: 200,
                userRemaining: 3,
                globalRemaining: 30,
                dateUtc: new Date().toISOString().split('T')[0],
                authenticated: Boolean(req.headers.authorization),
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          } else if (pathname === '/api/admin/usage') {
            response = new Response(
              JSON.stringify({
                dateUtc: new Date().toISOString().split('T')[0],
                totalCallsToday: 2,
                successfulCallsToday: 2,
                failedCallsToday: 0,
                rateLimitedCallsToday: 0,
                globalQuotaRemaining: 28,
                globalQuotaLimit: 30,
                activeUsersToday: 1,
                aiDisabled: false,
                featureBreakdown: { 'analyze-zoning': 2 },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          } else if (pathname === '/api/admin/kill-switch') {
            response = new Response(
              JSON.stringify({ success: true, aiDisabled: false }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          } else {
            const devUsageLimiter = {
              idFromName: () => ({}),
              get: () => ({
                checkAndReserve: async () => ({
                  allowed: true,
                  status: 200,
                  userRemaining: 3,
                  globalRemaining: 30,
                }),
                completeRequest: async () => {},
                getUserQuotaStatus: async () => ({
                  allowed: true,
                  status: 200,
                  userRemaining: 3,
                  globalRemaining: 30,
                }),
                getAdminStats: async () => ({
                  totalCallsToday: 0,
                  successfulCallsToday: 0,
                  failedCallsToday: 0,
                  rateLimitedCallsToday: 0,
                  globalQuotaRemaining: 30,
                  globalQuotaLimit: 30,
                  activeUsersToday: 1,
                  aiDisabled: false,
                  featureBreakdown: {},
                }),
                setKillSwitch: async () => {},
              }),
            };

            const devEnv = {
              ...process.env,
              USAGE_LIMITER: devUsageLimiter,
              ENVIRONMENT: 'development',
              FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'codescout-free',
            };

            if (pathname === '/api/analyze-policy') {
              const { handleAnalyzePolicy } = await import('./api/analyze-policy');
              response = await handleAnalyzePolicy(webReq, devEnv);
            } else if (pathname === '/api/analyze-zoning') {
              const { handleAnalyzeZoning } = await import('./api/analyze-zoning');
              response = await handleAnalyzeZoning(webReq, devEnv);
            } else if (pathname === '/api/chat-assistant') {
              const { handleChatAssistant } = await import('./api/chat-assistant');
              response = await handleChatAssistant(webReq, devEnv);
            } else if (pathname === '/api/refine-policy') {
              const { handleRefinePolicy } = await import('./api/refine-policy');
              response = await handleRefinePolicy(webReq, devEnv);
            } else if (pathname === '/api/translate-report') {
              const { handleTranslateReport } = await import('./api/translate-report');
              response = await handleTranslateReport(webReq, devEnv);
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: `API route not found: ${pathname}` }));
              return;
            }
          }

          if (response) {
            res.statusCode = response.status;
            response.headers.forEach((val, key) => {
              res.setHeader(key, val);
            });
            const text = await response.text();
            res.end(text);
          }
        } catch (err: any) {
          console.error('[Dev API Middleware Error]', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: err?.message || 'Internal Server Error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevMiddleware()],
});