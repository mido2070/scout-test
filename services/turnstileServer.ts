/**
 * Cloudflare Turnstile Server-Side Verification
 * Validates bot-prevention tokens with the Cloudflare Siteverify API.
 */

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes?: string[];
  hostname?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  request: Request,
  secretKey?: string
): Promise<TurnstileVerificationResult> {
  // If secret key is not configured, pass through (e.g., local development before setup)
  if (!secretKey || secretKey.trim() === '') {
    return { success: true };
  }

  if (!token || token.trim() === '') {
    return {
      success: false,
      errorCodes: ['missing-input-response'],
    };
  }

  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', clientIp);

    const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const res = await fetch(siteverifyUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.error(`[Turnstile] Verification endpoint returned HTTP ${res.status}`);
      return { success: false, errorCodes: [`http-${res.status}`] };
    }

    const outcome = (await res.json()) as any;
    return {
      success: Boolean(outcome.success),
      errorCodes: outcome['error-codes'],
      hostname: outcome.hostname,
    };
  } catch (error: any) {
    console.error('[Turnstile] Error during verification:', error?.message || error);
    return { success: false, errorCodes: ['verification-exception'] };
  }
}
