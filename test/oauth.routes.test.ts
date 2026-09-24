import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { registerUser } from '../src/services/auth.service';
import { createSession } from '../src/services/session.service';
import { execute } from '../src/db/client';
import { generateCodeChallenge } from '../src/crypto/pkce';
import { decodeJwt } from '../src/crypto/jwt';
import { generateCsrfToken } from '../src/crypto/csrf';
import type { Bindings } from '../src/types/env';

describe('OAuth 2.0 and OIDC Routes End-to-End Tests', () => {
  let db: MockD1Database;
  let mockEnv: Bindings;
  const clientId = 'client_test_app';
  const clientSecret = 'secret_test_xyz123';
  const redirectUri = 'https://consumer.example.com/oauth/callback';
  let userId: string;
  let userName: string;
  let sessionId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    mockEnv = {
      DB: db,
      AUTH_URL: 'https://auth.example.com',
      SITE_NAME: 'EasyOAuth Test Provider',
    };

    const now = Math.floor(Date.now() / 1000);

    // Seed test client
    await execute(
      db,
      `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      clientId,
      clientSecret,
      'My Consumer Application',
      JSON.stringify([redirectUri]),
      JSON.stringify(['openid', 'profile']),
      0,
      now,
      now
    );

    // Seed user & active session
    userName = 'oidc_user';
    const { user } = await registerUser(db, userName, 'StrongPassword123!');
    userId = user.id;

    const session = await createSession(db, userId);
    sessionId = session.id;
  });

  describe('OIDC Discovery Endpoints', () => {
    it('GET /.well-known/openid-configuration returns 200 with OIDC metadata', async () => {
      const res = await app.request('/.well-known/openid-configuration', {}, mockEnv);
      expect(res.status).toBe(200);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.issuer).toBe('https://auth.example.com');
      expect(json.authorization_endpoint).toBe('https://auth.example.com/oauth/authorize');
      expect(json.token_endpoint).toBe('https://auth.example.com/oauth/token');
      expect(json.userinfo_endpoint).toBe('https://auth.example.com/oauth/userinfo');
      expect(json.jwks_uri).toBe('https://auth.example.com/.well-known/jwks.json');
    });

    it('GET /.well-known/jwks.json returns 200 with public keys', async () => {
      const res = await app.request('/.well-known/jwks.json', {}, mockEnv);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { keys: any[] };
      expect(json).toHaveProperty('keys');
      expect(json.keys.length).toBeGreaterThan(0);
      expect(json.keys[0].kty).toBe('RSA');
      expect(json.keys[0].alg).toBe('RS256');
    });
  });

  describe('GET /oauth/authorize', () => {
    it('redirects to /login when user is not authenticated', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid profile',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'xyz_state_123',
      });

      const res = await app.request(`/oauth/authorize?${params.toString()}`, {}, mockEnv);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('/login?return_to=');
    });

    it('renders Consent page when user is logged in', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid profile',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'xyz_state_123',
      });

      const res = await app.request(
        `/oauth/authorize?${params.toString()}`,
        {
          headers: { Cookie: `easy_session=${sessionId}` },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('My Consumer Application');
      expect(html).toContain(userName);
      expect(html).toContain('OpenID Connect');
      expect(html).toContain('Profile Info');
    });

    it('returns 400 when client_id or redirect_uri is invalid', async () => {
      const res = await app.request(
        `/oauth/authorize?client_id=${clientId}&redirect_uri=https://unauthorized.com/cb`,
        {},
        mockEnv
      );
      expect(res.status).toBe(400);
    });
  });

  describe('Full OAuth 2.0 + OIDC Code Grant Flow', () => {
    it('executes Consent -> Token Exchange -> UserInfo -> Revoke flow', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      const csrfToken = await generateCsrfToken(sessionId);

      // Step 1: POST /oauth/consent (allow)
      const consentBody = new URLSearchParams({
        decision: 'allow',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid profile',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'state_random_789',
        nonce: 'nonce_custom_999',
        _csrf: csrfToken,
      });

      const consentRes = await app.request(
        '/oauth/consent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${sessionId}`,
          },
          body: consentBody.toString(),
        },
        mockEnv
      );

      expect(consentRes.status).toBe(302);
      const redirectLocation = consentRes.headers.get('Location')!;
      expect(redirectLocation).toBeDefined();

      const redirectUrl = new URL(redirectLocation);
      expect(redirectUrl.origin + redirectUrl.pathname).toBe(redirectUri);
      expect(redirectUrl.searchParams.get('state')).toBe('state_random_789');

      const authCode = redirectUrl.searchParams.get('code')!;
      expect(authCode).toBeDefined();
      expect(authCode.startsWith('code_')).toBe(true);

      // Step 2: POST /oauth/token (Exchange code for tokens)
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });

      const tokenRes = await app.request(
        '/oauth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenBody.toString(),
        },
        mockEnv
      );

      expect(tokenRes.status).toBe(200);
      expect(tokenRes.headers.get('Cache-Control')).toBe('no-store');
      expect(tokenRes.headers.get('Pragma')).toBe('no-cache');

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        id_token?: string;
      };

      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();

      // Verify ID Token includes the requested nonce
      const decodedIdToken = decodeJwt<{ nonce?: string }>(tokens.id_token!);
      expect(decodedIdToken.payload.nonce).toBe('nonce_custom_999');

      // Step 3: GET /oauth/userinfo with Bearer token
      const userinfoRes = await app.request(
        '/oauth/userinfo',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
        mockEnv
      );

      expect(userinfoRes.status).toBe(200);
      const userInfo = (await userinfoRes.json()) as {
        sub: string;
        preferred_username: string;
        updated_at?: number;
      };

      expect(userInfo.sub).toBe(userId);
      expect(userInfo.preferred_username).toBe(userName);
      expect((userInfo as any).email).toBeUndefined();

      // Step 4: POST /oauth/revoke to revoke access token
      const revokeBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: tokens.access_token,
      });

      const revokeRes = await app.request(
        '/oauth/revoke',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: revokeBody.toString(),
        },
        mockEnv
      );

      expect(revokeRes.status).toBe(200);

      // Step 5: UserInfo request with revoked token must now be 401 Unauthorized
      const userinfoAfterRevoke = await app.request(
        '/oauth/userinfo',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
        mockEnv
      );

      expect(userinfoAfterRevoke.status).toBe(401);
    });

    it('handles user denial in /oauth/consent', async () => {
      const csrfToken = await generateCsrfToken(sessionId);
      const consentBody = new URLSearchParams({
        decision: 'deny',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid',
        code_challenge: 'chal',
        state: 'denied_state',
        _csrf: csrfToken,
      });

      const res = await app.request(
        '/oauth/consent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${sessionId}`,
          },
          body: consentBody.toString(),
        },
        mockEnv
      );

      expect(res.status).toBe(302);
      const loc = new URL(res.headers.get('Location')!);
      expect(loc.searchParams.get('error')).toBe('access_denied');
      expect(loc.searchParams.get('state')).toBe('denied_state');
    });
  });
});
