/**
 * Cloudflare Workers-compatible Firebase ID Token verification
 * Uses native Web Crypto API (crypto.subtle) and Google's public JWKS.
 */

interface GoogleJwks {
  keys: Array<{
    kty: string;
    alg: string;
    use: string;
    kid: string;
    n: string;
    e: string;
  }>;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

let cachedJwks: GoogleJwks | null = null;
let jwksCacheExpires = 0;

/**
 * Fetch and cache Google's public certificates for Firebase Auth
 */
async function getGoogleJwks(): Promise<GoogleJwks> {
  const now = Date.now();
  if (cachedJwks && now < jwksCacheExpires) {
    return cachedJwks;
  }

  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google JWKS: ${res.statusText}`);
  }

  // Cache based on Cache-Control header, default to 1 hour
  const cacheControl = res.headers.get('cache-control');
  let maxAge = 3600;
  if (cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    if (match && match[1]) {
      maxAge = parseInt(match[1], 10);
    }
  }

  cachedJwks = (await res.json()) as GoogleJwks;
  jwksCacheExpires = now + maxAge * 1000;
  return cachedJwks;
}

/**
 * Convert base64url string to Uint8Array
 */
function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verify a Firebase ID token using native Web Crypto
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId?: string
): Promise<VerifiedUser> {
  if (!token) {
    throw new Error('Authentication required. Missing Firebase ID token.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token: Expected 3 JWT parts.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg: string; kid: string };
  let payload: {
    iss: string;
    aud: string;
    sub: string;
    exp: number;
    iat: number;
    email?: string;
    name?: string;
    picture?: string;
  };

  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  } catch {
    throw new Error('Invalid token encoding.');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported token algorithm: ${header.alg}. Expected RS256.`);
  }

  // Validate timing
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Authentication expired. Please sign in again.');
  }
  if (payload.iat > now + 300) {
    throw new Error('Token issued in the future.');
  }

  // Mandatory Firebase Project ID validation (Fail-closed)
  const cleanProjectId = projectId?.trim();
  const invalidPlaceholders = ['demo-project', 'placeholder', 'your-project-id', ''];
  if (!cleanProjectId || invalidPlaceholders.includes(cleanProjectId.toLowerCase())) {
    throw new Error(
      'Server authentication misconfigured: FIREBASE_PROJECT_ID is mandatory and must be a valid, configured Firebase project ID.'
    );
  }

  // Strictly enforce issuer and audience for the configured Firebase project
  const expectedIss = `https://securetoken.google.com/${cleanProjectId}`;
  if (payload.iss !== expectedIss) {
    throw new Error(`Token issuer mismatch. Expected: ${expectedIss}, got: ${payload.iss}`);
  }
  if (payload.aud !== cleanProjectId) {
    throw new Error(`Token audience mismatch. Expected: ${cleanProjectId}, got: ${payload.aud}`);
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token missing valid user identifier (sub).');
  }

  // Cryptographic signature verification
  const jwks = await getGoogleJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error('No matching public key found in Google certificates.');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      ext: true,
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['verify']
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature as any,
    signedData as any
  );

  if (!isValid) {
    throw new Error('Cryptographic signature verification failed.');
  }

  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

/**
 * Extract and authenticate user from request Authorization header
 */
export async function authenticateRequest(
  request: Request,
  env?: any
): Promise<VerifiedUser> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Sign in with Google to start your free AI analysis.');
  }

  const token = authHeader.substring(7).trim();

  // Allow preview token in non-production environments for local/preview testing
  const isDev =
    env?.ENVIRONMENT === 'development' ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' && env?.ENVIRONMENT !== 'production');
  if (token === 'mock-preview-token' && isDev) {
    return {
      uid: 'preview-user-101',
      email: 'user@codescout.app',
      name: 'CodeScout Architect',
    };
  }

  const projectId = env?.FIREBASE_PROJECT_ID || (typeof process !== 'undefined' ? process.env.FIREBASE_PROJECT_ID : undefined);

  if (!projectId || projectId.trim() === '') {
    throw new Error('Server authentication misconfigured: FIREBASE_PROJECT_ID is missing from Worker environment.');
  }

  return verifyFirebaseIdToken(token, projectId.trim());
}
