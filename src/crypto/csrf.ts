import { base64UrlEncode, base64UrlDecode } from './token';
import { timingSafeEqual } from './password';

const DEFAULT_CSRF_SALT = 'easy-oauth-csrf-salt-v1';

/**
 * Generates an HMAC-SHA256 signature for a session ID to produce a deterministic,
 * zero-database Session-Bound CSRF Token.
 */
export async function generateCsrfToken(
  sessionId: string,
  secretKey: string = DEFAULT_CSRF_SALT
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`csrf:${sessionId}`)
  );

  return base64UrlEncode(signature);
}

/**
 * Verifies that the submitted CSRF token matches the session ID.
 */
export async function verifyCsrfToken(
  submittedToken: string | null | undefined,
  sessionId: string | null | undefined,
  secretKey: string = DEFAULT_CSRF_SALT
): Promise<boolean> {
  if (!submittedToken || !sessionId) {
    return false;
  }

  try {
    const expectedToken = await generateCsrfToken(sessionId, secretKey);
    return timingSafeEqual(submittedToken, expectedToken);
  } catch {
    return false;
  }
}
