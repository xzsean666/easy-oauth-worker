import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { execute } from '../src/db/client';
import {
  validateClient,
  validateClientScope,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  refreshAccessToken,
  revokeToken,
  revokeAllUserTokens,
  validateAccessToken,
} from '../src/services/oauth.service';
import { generateCodeChallenge } from '../src/crypto/pkce';
import { registerUser } from '../src/services/auth.service';

describe('OAuth 2.0 Service Tests', () => {
  let db: MockD1Database;
  const clientId = 'test_client_id';
  const clientSecret = 'test_client_secret_12345';
  const redirectUri = 'https://app.example.com/callback';
  let userId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    const now = Math.floor(Date.now() / 1000);

    // Seed confidential client
    await execute(
      db,
      `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      clientId,
      clientSecret,
      'Test App',
      JSON.stringify([redirectUri, 'https://app.example.com/alt-callback']),
      JSON.stringify(['openid', 'profile']),
      0,
      now,
      now
    );

    // Seed public client (SPA/Mobile)
    await execute(
      db,
      `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      'public_client_id',
      '',
      'Public SPA App',
      JSON.stringify(['https://spa.example.com/callback']),
      JSON.stringify(['openid', 'profile']),
      1,
      now,
      now
    );

    // Seed user
    const { user } = await registerUser(db, 'oauth_user', 'Password123!');
    userId = user.id;
  });

  describe('Client Validation and Redirect URI Whitelisting', () => {
    it('validates confidential client with correct secret and registered redirect URI', async () => {
      const client = await validateClient(db, clientId, clientSecret, redirectUri);
      expect(client).toBeDefined();
      expect(client.client_id).toBe(clientId);
    });

    it('validates public client without requiring secret', async () => {
      const client = await validateClient(db, 'public_client_id', undefined, 'https://spa.example.com/callback');
      expect(client.client_id).toBe('public_client_id');
      expect(client.is_public).toBe(1);
    });

    it('rejects confidential client with incorrect secret', async () => {
      await expect(
        validateClient(db, clientId, 'wrong_secret', redirectUri)
      ).rejects.toThrow('Invalid client_secret');
    });

    it('rejects unregistered or mismatched redirect_uri', async () => {
      await expect(
        validateClient(db, clientId, clientSecret, 'https://evil.example.com/callback')
      ).rejects.toThrow('not registered for this client');
    });

    it('rejects non-existent client_id', async () => {
      await expect(
        validateClient(db, 'non_existent_client', 'secret')
      ).rejects.toThrow('client not found');
    });
  });

  describe('Authorization Code Creation', () => {
    it('creates authorization code with PKCE S256 challenge', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code, expiresAt } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid profile',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });

      expect(code.startsWith('code_')).toBe(true);
      expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects code challenge method other than S256', async () => {
      await expect(
        createAuthorizationCode(db, {
          clientId,
          userId,
          redirectUri,
          scope: 'openid',
          codeChallenge: 'some_challenge',
          codeChallengeMethod: 'plain',
        })
      ).rejects.toThrow("Only 'S256' is accepted");
    });
  });

  describe('Authorization Code Exchange (PKCE + Token Issuance)', () => {
    it('exchanges code for tokens using valid verifier and prevents replay attack', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid profile',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });

      // Successful exchange
      const tokenRes = await exchangeAuthorizationCode(db, {
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier: verifier,
      });

      expect(tokenRes.token_type).toBe('Bearer');
      expect(tokenRes.access_token).toBeDefined();
      expect(tokenRes.refresh_token).toBeDefined();
      expect(tokenRes.expires_in).toBe(3600);
      expect(tokenRes.user_id).toBe(userId);

      // Replay attack: second exchange with the same code must fail!
      await expect(
        exchangeAuthorizationCode(db, {
          clientId,
          clientSecret,
          code,
          redirectUri,
          codeVerifier: verifier,
        })
      ).rejects.toThrow('replay attack detected');
    });

    it('rejects exchange when PKCE verifier does not match challenge', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });

      const wrongVerifier = 'wrong_verifier_123456789012345678901234567890123';
      await expect(
        exchangeAuthorizationCode(db, {
          clientId,
          clientSecret,
          code,
          redirectUri,
          codeVerifier: wrongVerifier,
        })
      ).rejects.toThrow('PKCE verification failed');
    });

    it('rejects exchange when redirect_uri does not match authorization', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });

      await expect(
        exchangeAuthorizationCode(db, {
          clientId,
          clientSecret,
          code,
          redirectUri: 'https://app.example.com/alt-callback', // registered for client, but differs from code issuance
          codeVerifier: verifier,
        })
      ).rejects.toThrow('redirect_uri does not match');
    });

    it('rejects expired authorization code', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid',
        codeChallenge: challenge,
        durationSeconds: -10, // expired
      });

      await expect(
        exchangeAuthorizationCode(db, {
          clientId,
          clientSecret,
          code,
          redirectUri,
          codeVerifier: verifier,
        })
      ).rejects.toThrow('Authorization code has expired');
    });
  });

  describe('Refresh Token and Token Revocation', () => {
    it('refreshes access token and validates token state', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid profile',
        codeChallenge: challenge,
      });

      const initialTokens = await exchangeAuthorizationCode(db, {
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier: verifier,
      });

      // Validate access token
      const check1 = await validateAccessToken(db, initialTokens.access_token);
      expect(check1?.isValid).toBe(true);

      // Refresh token
      const refreshed = await refreshAccessToken(db, {
        clientId,
        clientSecret,
        refreshToken: initialTokens.refresh_token!,
      });

      expect(refreshed.access_token).toBeDefined();
      expect(refreshed.access_token).not.toBe(initialTokens.access_token);

      // Old refresh token revoked
      await expect(
        refreshAccessToken(db, {
          clientId,
          clientSecret,
          refreshToken: initialTokens.refresh_token!,
        })
      ).rejects.toThrow('Refresh token has been revoked');
    });

    it('revokes access token and invalidates future requests', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid',
        codeChallenge: challenge,
      });

      const tokens = await exchangeAuthorizationCode(db, {
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier: verifier,
      });

      const beforeRevoke = await validateAccessToken(db, tokens.access_token);
      expect(beforeRevoke?.isValid).toBe(true);

      // Revoke token
      await revokeToken(db, {
        clientId,
        clientSecret,
        token: tokens.access_token,
      });

      const afterRevoke = await validateAccessToken(db, tokens.access_token);
      expect(afterRevoke?.isValid).toBe(false);
    });

    it('rejects scope escalation on refresh token and allows narrowing scope', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid profile',
        codeChallenge: challenge,
      });

      const tokens = await exchangeAuthorizationCode(db, {
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier: verifier,
      });

      // Attempting to escalate scope should fail
      await expect(
        refreshAccessToken(db, {
          clientId,
          clientSecret,
          refreshToken: tokens.refresh_token!,
          scope: 'openid profile admin:write',
        })
      ).rejects.toThrow("Scope 'admin:write' exceeds originally granted scopes");

      // Narrowing scope should succeed
      const narrowed = await refreshAccessToken(db, {
        clientId,
        clientSecret,
        refreshToken: tokens.refresh_token!,
        scope: 'openid',
      });

      expect(narrowed.scope).toBe('openid');
    });

    it('rejects refresh token after 30 days expiration', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid',
        codeChallenge: challenge,
      });

      const tokens = await exchangeAuthorizationCode(db, {
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier: verifier,
      });

      // Artificially age the token past 30 days
      const thirtyOneDaysAgo = Math.floor(Date.now() / 1000) - (31 * 24 * 3600);
      await execute(
        db,
        'UPDATE oauth_tokens SET created_at = ? WHERE refresh_token = ?',
        thirtyOneDaysAgo,
        tokens.refresh_token!
      );

      await expect(
        refreshAccessToken(db, {
          clientId,
          clientSecret,
          refreshToken: tokens.refresh_token!,
        })
      ).rejects.toThrow('Refresh token has expired');
    });

    it('revokes all user tokens via revokeAllUserTokens', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const { code } = await createAuthorizationCode(db, {
        clientId,
        userId,
        redirectUri,
        scope: 'openid',
        codeChallenge: challenge,
      });

      const tokens = await exchangeAuthorizationCode(db, {
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier: verifier,
      });

      const check1 = await validateAccessToken(db, tokens.access_token);
      expect(check1?.isValid).toBe(true);

      await revokeAllUserTokens(db, userId);

      const check2 = await validateAccessToken(db, tokens.access_token);
      expect(check2?.isValid).toBe(false);
    });
  });

  describe('Client Scope Enforcement', () => {
    it('validates allowed scopes and rejects unauthorized scopes', async () => {
      const client = await validateClient(db, clientId);

      expect(() => {
        validateClientScope(client, 'openid profile');
      }).not.toThrow();

      expect(() => {
        validateClientScope(client, 'openid admin:super');
      }).toThrow("Scope 'admin:super' is not allowed for this client");
    });
  });
});
