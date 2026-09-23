import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { execute } from '../src/db/client';
import { generateCodeChallenge } from '../src/crypto/pkce';
import { generateRandomToken } from '../src/crypto/token';
import { decodeJwt, verifyJwt, importPublicKey, type ExtendedJsonWebKey } from '../src/crypto/jwt';
import type { Bindings } from '../src/types/env';

describe('End-to-End (E2E) OAuth 2.0 PKCE + OIDC Provider Integration', () => {
  let db: MockD1Database;
  let mockEnv: Bindings;

  const clientId = 'e2e_consumer_app';
  const clientSecret = 'e2e_client_super_secret_123';
  const redirectUri = 'https://consumer-app.com/api/auth/callback';

  beforeEach(async () => {
    db = createTestDatabase();
    mockEnv = {
      DB: db,
      AUTH_URL: 'https://auth.mycompany.com',
      SITE_NAME: 'MyCloud ID Provider',
    };

    const now = Math.floor(Date.now() / 1000);

    // Seed consumer application
    await execute(
      db,
      `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      clientId,
      clientSecret,
      'Enterprise Portal',
      JSON.stringify([redirectUri]),
      JSON.stringify(['openid', 'email', 'profile']),
      now,
      now
    );
  });

  it('completes the entire real-world authentication & OIDC flow from registration to token revoke', async () => {
    // -------------------------------------------------------------
    // Phase 1: Client prepares PKCE parameters & authorization request
    // -------------------------------------------------------------
    const codeVerifier = generateRandomToken(48); // 64+ char URL-safe string
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const clientState = 'csrf_state_token_999';
    const clientNonce = 'oidc_nonce_xyz_888';

    const authQueryParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: clientState,
      nonce: clientNonce,
    });

    // User visits authorization endpoint without an active session
    const unauthenticatedAuthRes = await app.request(
      `/oauth/authorize?${authQueryParams.toString()}`,
      {},
      mockEnv
    );

    // Expect redirect to login with return_to preserved
    expect(unauthenticatedAuthRes.status).toBe(302);
    const loginLocation = unauthenticatedAuthRes.headers.get('Location')!;
    expect(loginLocation).toContain('/login?return_to=');

    // -------------------------------------------------------------
    // Phase 2: User registration & login on EasyOAuth
    // -------------------------------------------------------------
    const userEmail = 'alice.engineer@mycompany.com';
    const userPassword = 'CorrectBatteryHorse123!';

    // Register user
    const registerFormData = new URLSearchParams({
      email: userEmail,
      password: userPassword,
      confirm_password: userPassword,
    });

    const registerRes = await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: registerFormData.toString(),
      },
      mockEnv
    );
    expect(registerRes.status).toBe(200);

    // Verify user email directly in DB for test flow
    await execute(db, 'UPDATE users SET email_verified = 1 WHERE email = ?', userEmail.toLowerCase());

    // Login user
    const loginFormData = new URLSearchParams({
      email: userEmail,
      password: userPassword,
    });

    const loginRes = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: loginFormData.toString(),
      },
      mockEnv
    );

    expect(loginRes.status).toBe(302);
    const setCookie = loginRes.headers.get('Set-Cookie')!;
    expect(setCookie).toContain('easy_session=sess_');

    // Extract session cookie
    const sessionMatch = setCookie.match(/easy_session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : '';
    expect(sessionId).toBeTruthy();

    // -------------------------------------------------------------
    // Phase 3: Authorization request with active session (Consent UI)
    // -------------------------------------------------------------
    const consentPageRes = await app.request(
      `/oauth/authorize?${authQueryParams.toString()}`,
      {
        headers: { Cookie: `easy_session=${sessionId}` },
      },
      mockEnv
    );

    expect(consentPageRes.status).toBe(200);
    const consentHtml = await consentPageRes.text();
    expect(consentHtml).toContain('Enterprise Portal');
    expect(consentHtml).toContain(userEmail);
    expect(consentHtml).toContain('OpenID Connect');

    // User submits consent (allow)
    const consentPostData = new URLSearchParams({
      decision: 'allow',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: clientState,
      nonce: clientNonce,
    });

    const consentSubmitRes = await app.request(
      '/oauth/consent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `easy_session=${sessionId}`,
        },
        body: consentPostData.toString(),
      },
      mockEnv
    );

    expect(consentSubmitRes.status).toBe(302);
    const callbackRedirect = new URL(consentSubmitRes.headers.get('Location')!);
    expect(callbackRedirect.origin + callbackRedirect.pathname).toBe(redirectUri);
    expect(callbackRedirect.searchParams.get('state')).toBe(clientState);

    const authorizationCode = callbackRedirect.searchParams.get('code')!;
    expect(authorizationCode).toBeTruthy();
    expect(authorizationCode.startsWith('code_')).toBe(true);

    // -------------------------------------------------------------
    // Phase 4: Consumer App exchanges code for Access Token & ID Token
    // -------------------------------------------------------------
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier, // PKCE verification
    });

    // Consumer App uses HTTP Basic Authentication
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const tokenRes = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: tokenRequestBody.toString(),
      },
      mockEnv
    );

    expect(tokenRes.status).toBe(200);
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      id_token: string;
      scope: string;
    };

    expect(tokenData.token_type).toBe('Bearer');
    expect(tokenData.access_token).toBeDefined();
    expect(tokenData.refresh_token).toBeDefined();
    expect(tokenData.id_token).toBeDefined();

    // -------------------------------------------------------------
    // Phase 5: Consumer App fetches JWKS & validates ID Token (OIDC)
    // -------------------------------------------------------------
    const jwksRes = await app.request('/.well-known/jwks.json', {}, mockEnv);
    expect(jwksRes.status).toBe(200);
    const jwks = (await jwksRes.json()) as { keys: ExtendedJsonWebKey[] };

    const decodedIdToken = decodeJwt(tokenData.id_token);
    expect(decodedIdToken.header.alg).toBe('RS256');

    // Find matching public key from JWKS
    const matchingKeyJwk = jwks.keys.find((k) => k.kid === decodedIdToken.header.kid);
    expect(matchingKeyJwk).toBeDefined();

    const publicKey = await importPublicKey(matchingKeyJwk!);
    const verifiedIdTokenClaims = await verifyJwt<{
      iss: string;
      sub: string;
      aud: string;
      email: string;
      email_verified: boolean;
      nonce?: string;
    }>(tokenData.id_token, publicKey);

    expect(verifiedIdTokenClaims.iss).toBe('https://auth.mycompany.com');
    expect(verifiedIdTokenClaims.aud).toBe(clientId);
    expect(verifiedIdTokenClaims.email).toBe(userEmail);
    expect(verifiedIdTokenClaims.email_verified).toBe(true);

    // -------------------------------------------------------------
    // Phase 6: Consumer App accesses UserInfo endpoint with Access Token
    // -------------------------------------------------------------
    const userinfoRes = await app.request(
      '/oauth/userinfo',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
      mockEnv
    );

    expect(userinfoRes.status).toBe(200);
    const userinfo = (await userinfoRes.json()) as {
      sub: string;
      email: string;
      email_verified: boolean;
    };

    expect(userinfo.sub).toBe(verifiedIdTokenClaims.sub);
    expect(userinfo.email).toBe(userEmail);
    expect(userinfo.email_verified).toBe(true);

    // -------------------------------------------------------------
    // Phase 7: Refresh Access Token using Refresh Token
    // -------------------------------------------------------------
    const refreshRequestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
    });

    const refreshRes = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: refreshRequestBody.toString(),
      },
      mockEnv
    );

    expect(refreshRes.status).toBe(200);
    const refreshedTokenData = (await refreshRes.json()) as {
      access_token: string;
      refresh_token: string;
    };
    expect(refreshedTokenData.access_token).not.toBe(tokenData.access_token);

    // -------------------------------------------------------------
    // Phase 8: Revoke Token & verify access is revoked
    // -------------------------------------------------------------
    const revokeRequestBody = new URLSearchParams({
      token: refreshedTokenData.access_token,
    });

    const revokeRes = await app.request(
      '/oauth/revoke',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: revokeRequestBody.toString(),
      },
      mockEnv
    );
    expect(revokeRes.status).toBe(200);

    // Calling userinfo with revoked token must be rejected with 401
    const userinfoAfterRevokeRes = await app.request(
      '/oauth/userinfo',
      {
        headers: { Authorization: `Bearer ${refreshedTokenData.access_token}` },
      },
      mockEnv
    );
    expect(userinfoAfterRevokeRes.status).toBe(401);
  });
});
