# CodeScout — target repair, 29 October 2026

Repository: https://github.com/mido2070/scout-test

The latest provided Cloudflare build log stops immediately after `npm run build`. The final TypeScript error isn't shown, so a passing build cannot yet be confirmed. This repair targets a verified missing export plus additional security gaps discovered by source inspection.

## Audited code defects

1. `worker.ts` imports and calls `checkRateLimit`; `services/apiUtils.ts` exports `checkEdgeRateLimit`.
2. `tsconfig.json` restricts `types` to Cloudflare Worker types, while `vite.config.ts` uses Node's `Buffer` and `process` globals. The already checked-in Bun lockfile lists `@types/node`.
3. `services/apiUtils.ts` currently skips quota coordination if `USAGE_LIMITER` is missing.
4. `services/apiUtils.ts` can skip required Turnstile validation when the secret isn't configured.
5. `services/firebaseAuthServer.ts` skips JWT issuer and audience checks when the Firebase project ID is missing or set to the demo placeholder.

## How to apply

Copy `codescout_build_security_fix.py` to the repository root, then run:

```bash
python codescout_build_security_fix.py
npm run build
npx wrangler deploy --dry-run
```

Review the diff and commit to a new branch. Do not enable `GEMINI_API_KEY` for public users yet.

## Critical remaining configuration work

The repository's Wrangler files do not currently bind `USAGE_LIMITER` to a real SQLite-backed Durable Object. The script *intentionally makes AI return HTTP 503* until that limiter is implemented and configured. It does not create the Durable Object.

Actual `FIREBASE_PROJECT_ID`, Firebase frontend VITE_* build variables, and Turnstile configuration are also required before end-to-end AI analysis is usable. The website's static UI should remain available.

Cloudflare Worker Free and Gemini Free are separate services: keeping a Gemini project unbilled is necessary for avoiding paid Gemini API charges. Do not configure a paid Gemini key as a fallback.

The GitHub connector permitted repository reads but rejected creating a repair branch with HTTP 403. No repository changes or Cloudflare deployments were performed from this chat.
