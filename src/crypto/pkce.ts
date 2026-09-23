import { base64UrlEncode } from './token';
import { timingSafeEqual } from './password';

const PKCE_VERIFIER_REGEX = /^[A-Za-z0-9\-_.~]{43,128}$/;

/**
 * Validates whether a code verifier conforms to RFC 7636.
 */
export function isValidCodeVerifier(verifier: string): boolean {
  return PKCE_VERIFIER_REGEX.test(verifier);
}

/**
 * Generates an S256 code challenge for the provided code verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return base64UrlEncode(digest);
}

/**
 * Verifies a code verifier against a code challenge using the specified method.
 * Only 'S256' is accepted by easy-oauth-worker as per ADR-003.
 */
export async function verifyCodeChallenge(
  verifier: string,
  challenge: string,
  method: string = 'S256'
): Promise<boolean> {
  if (method !== 'S256') {
    return false;
  }
  if (!isValidCodeVerifier(verifier)) {
    return false;
  }

  const computedChallenge = await generateCodeChallenge(verifier);
  return timingSafeEqual(computedChallenge, challenge);
}
