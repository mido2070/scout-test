#!/usr/bin/env python3
"""Targeted CodeScout Cloudflare build/security repair.

Run from the root of an existing clone of mido2070/scout-test.
This script does not deploy, call Google APIs, or change billing settings.
It refuses unexpected file contents rather than silently replacing code.
"""
from pathlib import Path
import sys

ROOT = Path.cwd()
changes = [
    (
        'worker.ts',
        "import { checkRateLimit, corsHeaders, jsonResponse } from './services/apiUtils';",
        "import { checkEdgeRateLimit, corsHeaders, jsonResponse } from './services/apiUtils';",
    ),
    (
        'worker.ts',
        "const rateCheck = checkRateLimit(request, 40, 60_000);",
        "const rateCheck = checkEdgeRateLimit(request, 40, 60_000);",
    ),
    (
        'tsconfig.json',
        '"types": ["@cloudflare/workers-types"]',
        '"types": ["@cloudflare/workers-types", "node"]',
    ),
    (
        'services/apiUtils.ts',
        '  let limiterStub: any = null;\n  if (env?.USAGE_LIMITER) {',
        "  let limiterStub: any = null;\n  if (!env?.USAGE_LIMITER) {\n    return jsonResponse(\n      { message: 'AI analysis is unavailable until the centralized usage limiter is configured.' },\n      503\n    );\n  }\n  if (env?.USAGE_LIMITER) {",
    ),
    (
        'services/apiUtils.ts',
        '  const turnstileSecret = env?.TURNSTILE_SECRET_KEY;\n\n  if (turnstileSecret && featureName',
        "  const turnstileSecret = env?.TURNSTILE_SECRET_KEY;\n\n  if (featureName !== 'chat-assistant' && !turnstileSecret) {\n    return jsonResponse(\n      { message: 'AI verification is unavailable until Turnstile is configured.' },\n      503\n    );\n  }\n\n  if (turnstileSecret && featureName",
    ),
    (
        'services/firebaseAuthServer.ts',
        "  // Validate Project ID if provided\n  if (projectId && projectId !== 'demo-project') {\n    const expectedIss = `https://securetoken.google.com/${projectId}`;\n    if (payload.iss !== expectedIss) {\n      throw new Error(`Token issuer mismatch. Expected: ${expectedIss}, got: ${payload.iss}`);\n    }\n    if (payload.aud !== projectId) {\n      throw new Error(`Token audience mismatch. Expected: ${projectId}, got: ${payload.aud}`);\n    }\n  }",
        "  // Production must never accept tokens without a configured project identity.\n  if (!projectId || projectId === 'demo-project') {\n    throw new Error('Firebase project authentication is not configured.');\n  }\n  const expectedIss = `https://securetoken.google.com/${projectId}`;\n  if (payload.iss !== expectedIss || payload.aud !== projectId) {\n    throw new Error('Invalid Firebase token issuer or audience.');\n  }",
    ),
]

# Validate every edit before writing any files.
texts = {}
problems = []
for path, old, new in changes:
    f = ROOT / path
    if not f.is_file():
        problems.append(f'Missing file: {path}')
        continue
    text = texts.get(path, f.read_text(encoding='utf-8'))
    if new in text:
        texts[path] = text
        continue
    if text.count(old) != 1:
        problems.append(f'Expected exactly one match in {path}; found {text.count(old)}')
        continue
    texts[path] = text.replace(old, new, 1)

if problems:
    print('No changes written. Source does not match the audited revision:')
    print('\n'.join(' - ' + p for p in problems))
    sys.exit(2)

for path, updated in texts.items():
    f = ROOT / path
    original = f.read_text(encoding='utf-8')
    if original != updated:
        f.write_text(updated, encoding='utf-8')
        print('Updated:', path)
    else:
        print('Already correct:', path)

print('\nRun: npm run build')
print('Then: npx wrangler deploy --dry-run')
print('IMPORTANT: AI endpoints will intentionally return 503 until the real USAGE_LIMITER, Turnstile, and Firebase project are configured.')
