import { queryFirst, execute } from '../db/client';
import type { OAuthClient, OAuthAuthorizationCode, OAuthToken } from '../db/schema';
import { generateId, generateRandomToken } from '../crypto/token';
import { verifyCodeChallenge, isValidCodeVerifier } from '../crypto/pkce';
import { timingSafeEqual } from '../crypto/password';

export const AUTH_CODE_DURATION_SECONDS = 600; // 10 minutes
export const ACCESS_TOKEN_DURATION_SECONDS = 3600; // 1 hour
export const REFRESH_TOKEN_DURATION_SECONDS = 30 * 24 * 3600; // 30 days

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
  user_id: string;
  nonce?: string | null;
}

/**
 * Validates OAuth client credentials and redirect URI.
 */
export async function validateClient(
  db: D1Database,
  clientId: string,
  clientSecret?: string,
  redirectUri?: string,
  requireSecret = false
): Promise<OAuthClient> {
  const client = await queryFirst<OAuthClient>(
    db,
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    clientId
  );

  if (!client) {
    throw new Error('Invalid client_id: client not found');
  }

  // If confidential client, client_secret is required if requireSecret is true or if clientSecret is supplied
  if (client.is_public === 0 && (requireSecret || clientSecret !== undefined)) {
    if (!clientSecret || !timingSafeEqual(clientSecret, client.client_secret)) {
      throw new Error('Invalid client_secret');
    }
  }

  // If redirect_uri is provided, must strictly match allowed redirect URIs
  if (redirectUri) {
    let allowedUris: string[] = [];
    try {
      allowedUris = JSON.parse(client.redirect_uris);
    } catch {
      allowedUris = [];
    }

    if (!allowedUris.includes(redirectUri)) {
      throw new Error(`The redirect_uri '${redirectUri}' is not registered for this client`);
    }
  }

  return client;
}

/**
 * Validates that requested scopes are permitted for this OAuth client.
 */
export function validateClientScope(client: OAuthClient, requestedScope: string): void {
  let allowed: string[] = [];
  try {
    allowed = JSON.parse(client.allowed_scopes);
  } catch {
    allowed = [];
  }

  const requested = requestedScope.trim().split(/\s+/).filter(Boolean);
  for (const s of requested) {
    if (!allowed.includes(s)) {
      throw new Error(`Scope '${s}' is not allowed for this client`);
    }
  }
}

/**
 * Creates an authorization code bound to user, client, redirect_uri and PKCE challenge.
 */
export async function createAuthorizationCode(
  db: D1Database,
  params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string;
    codeChallenge: string;
    codeChallengeMethod?: string;
    nonce?: string;
    durationSeconds?: number;
  }
): Promise<{ code: string; expiresAt: number }> {
  const method = params.codeChallengeMethod || 'S256';
  if (method !== 'S256') {
    throw new Error("Unsupported code_challenge_method. Only 'S256' is accepted.");
  }

  if (!params.codeChallenge) {
    throw new Error('code_challenge is required (PKCE is mandatory)');
  }

  const code = generateId('code');
  const now = Math.floor(Date.now() / 1000);
  const duration = params.durationSeconds || AUTH_CODE_DURATION_SECONDS;
  const expiresAt = now + duration;

  await execute(
    db,
    `INSERT INTO oauth_authorization_codes (
      code, client_id, user_id, redirect_uri, scope,
      code_challenge, code_challenge_method, nonce, expires_at, used, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    code,
    params.clientId,
    params.userId,
    params.redirectUri,
    params.scope,
    params.codeChallenge,
    method,
    params.nonce || null,
    expiresAt,
    now
  );

  return { code, expiresAt };
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 */
export async function exchangeAuthorizationCode(
  db: D1Database,
  params: {
    clientId: string;
    clientSecret?: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }
): Promise<TokenResponse> {
  const now = Math.floor(Date.now() / 1000);

  // 1. Retrieve authorization code record
  const codeRecord = await queryFirst<OAuthAuthorizationCode>(
    db,
    'SELECT * FROM oauth_authorization_codes WHERE code = ?',
    params.code,
  );

  if (!codeRecord) {
    throw new Error('Invalid authorization code');
  }

  // 2. Validate client
  const client = await validateClient(db, params.clientId, params.clientSecret, undefined, true);
  if (codeRecord.client_id !== client.client_id) {
    throw new Error('Client mismatch for authorization code');
  }

  // 3. Prevent replay attacks (check used status)
  if (codeRecord.used === 1) {
    throw new Error('Authorization code has already been consumed (replay attack detected)');
  }

  // 4. Check expiration
  if (codeRecord.expires_at <= now) {
    throw new Error('Authorization code has expired');
  }

  // 5. Exact match on redirect_uri
  if (codeRecord.redirect_uri !== params.redirectUri) {
    throw new Error('redirect_uri does not match the one used during authorization');
  }

  // 6. Validate PKCE code_verifier
  if (!params.codeVerifier || !isValidCodeVerifier(params.codeVerifier)) {
    throw new Error('Invalid or missing PKCE code_verifier');
  }

  const isChallengeValid = await verifyCodeChallenge(
    params.codeVerifier,
    codeRecord.code_challenge,
    codeRecord.code_challenge_method
  );

  if (!isChallengeValid) {
    throw new Error('PKCE verification failed: code_verifier does not match code_challenge');
  }

  // 7. Atomic mark code as used
  await execute(
    db,
    'UPDATE oauth_authorization_codes SET used = 1 WHERE code = ?',
    params.code
  );

  // 8. Generate Tokens
  const tokenId = generateId('tok');
  const accessToken = generateRandomToken(32);
  const refreshToken = generateRandomToken(32);
  const expiresAt = now + ACCESS_TOKEN_DURATION_SECONDS;

  await execute(
    db,
    `INSERT INTO oauth_tokens (
      id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    tokenId,
    client.client_id,
    codeRecord.user_id,
    accessToken,
    refreshToken,
    codeRecord.scope,
    expiresAt,
    now
  );

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_DURATION_SECONDS,
    refresh_token: refreshToken,
    scope: codeRecord.scope,
    user_id: codeRecord.user_id,
    nonce: codeRecord.nonce || undefined,
  };
}

/**
 * Exchanges a valid refresh token for a new access token.
 */
export async function refreshAccessToken(
  db: D1Database,
  params: {
    clientId: string;
    clientSecret?: string;
    refreshToken: string;
    scope?: string;
  }
): Promise<TokenResponse> {
  const now = Math.floor(Date.now() / 1000);

  // 1. Validate client
  const client = await validateClient(db, params.clientId, params.clientSecret, undefined, true);

  // 2. Retrieve token record
  const tokenRecord = await queryFirst<OAuthToken>(
    db,
    'SELECT * FROM oauth_tokens WHERE refresh_token = ?',
    params.refreshToken
  );

  if (!tokenRecord || tokenRecord.client_id !== client.client_id) {
    throw new Error('Invalid refresh token');
  }

  if (tokenRecord.revoked === 1) {
    throw new Error('Refresh token has been revoked');
  }

  // Check 30-day refresh token expiration
  if (tokenRecord.created_at + REFRESH_TOKEN_DURATION_SECONDS <= now) {
    throw new Error('Refresh token has expired');
  }

  // Validate scope: client can narrow scope or keep it, but never escalate/expand
  let scope = tokenRecord.scope;
  if (params.scope) {
    const originalScopes = tokenRecord.scope.trim().split(/\s+/).filter(Boolean);
    const requestedScopes = params.scope.trim().split(/\s+/).filter(Boolean);
    for (const s of requestedScopes) {
      if (!originalScopes.includes(s)) {
        throw new Error(`Scope '${s}' exceeds originally granted scopes`);
      }
    }
    scope = params.scope;
  }

  // Revoke old token pair
  await execute(
    db,
    'UPDATE oauth_tokens SET revoked = 1 WHERE id = ?',
    tokenRecord.id
  );

  // Issue new token pair
  const newId = generateId('tok');
  const newAccessToken = generateRandomToken(32);
  const newRefreshToken = generateRandomToken(32);
  const expiresAt = now + ACCESS_TOKEN_DURATION_SECONDS;

  await execute(
    db,
    `INSERT INTO oauth_tokens (
      id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    newId,
    client.client_id,
    tokenRecord.user_id,
    newAccessToken,
    newRefreshToken,
    scope,
    expiresAt,
    now
  );

  return {
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_DURATION_SECONDS,
    refresh_token: newRefreshToken,
    scope,
    user_id: tokenRecord.user_id,
  };
}

/**
 * Revokes all active OAuth tokens for a specific user.
 */
export async function revokeAllUserTokens(
  db: D1Database,
  userId: string
): Promise<boolean> {
  const res = await execute(
    db,
    'UPDATE oauth_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0',
    userId
  );
  return (res.meta.changes ?? 0) > 0;
}

/**
 * Revokes an access token or refresh token.
 */
export async function revokeToken(
  db: D1Database,
  params: {
    clientId: string;
    clientSecret?: string;
    token: string;
  }
): Promise<boolean> {
  await validateClient(db, params.clientId, params.clientSecret, undefined, true);

  const res = await execute(
    db,
    'UPDATE oauth_tokens SET revoked = 1 WHERE (access_token = ? OR refresh_token = ?) AND client_id = ?',
    params.token,
    params.token,
    params.clientId
  );

  return (res.meta.changes ?? 0) > 0;
}

/**
 * Validates an access token and returns its active state.
 */
export async function validateAccessToken(
  db: D1Database,
  accessToken: string
): Promise<{ token: OAuthToken; isValid: boolean } | null> {
  const now = Math.floor(Date.now() / 1000);

  const token = await queryFirst<OAuthToken>(
    db,
    'SELECT * FROM oauth_tokens WHERE access_token = ?',
    accessToken
  );

  if (!token) {
    return null;
  }

  const isValid = token.revoked === 0 && token.expires_at > now;
  return { token, isValid };
}
