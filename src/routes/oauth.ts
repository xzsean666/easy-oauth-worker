import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppContext } from '../types/env';
import { SESSION_COOKIE_NAME } from './auth';
import { validateSession } from '../services/session.service';
import {
  validateClient,
  validateClientScope,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  refreshAccessToken,
  revokeToken,
} from '../services/oauth.service';
import { generateIdToken } from '../services/oidc.service';
import { generateCsrfToken, verifyCsrfToken } from '../crypto/csrf';
import { ConsentView } from '../views/oauth/consent';

export const oauthRoutes = new Hono<AppContext>();

function parseClientCredentials(c: any, body: Record<string, unknown>): {
  clientId: string;
  clientSecret?: string;
} {
  const authHeader = c.req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
    const base64Credentials = authHeader.substring(6).trim();
    try {
      const decoded = atob(base64Credentials);
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        const rawId = decoded.substring(0, colonIdx);
        const rawSecret = decoded.substring(colonIdx + 1);
        let clientId = rawId;
        let clientSecret = rawSecret;
        try {
          clientId = decodeURIComponent(rawId);
        } catch {}
        try {
          clientSecret = decodeURIComponent(rawSecret);
        } catch {}
        return { clientId, clientSecret };
      }
    } catch {}
  }

  const clientId = (body.client_id as string) || '';
  const clientSecret = (body.client_secret as string) || undefined;
  return { clientId, clientSecret };
}

// GET /oauth/authorize
oauthRoutes.get('/oauth/authorize', async (c) => {
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');
  const responseType = c.req.query('response_type');
  const scope = c.req.query('scope') || 'openid';
  const codeChallenge = c.req.query('code_challenge');
  const codeChallengeMethod = c.req.query('code_challenge_method') || 'S256';
  const state = c.req.query('state');
  const nonce = c.req.query('nonce');

  if (!clientId || !redirectUri) {
    return c.text('Missing required parameters: client_id and redirect_uri', 400);
  }

  // Validate client and redirect_uri early
  let client;
  try {
    client = await validateClient(c.env.DB, clientId, undefined, redirectUri);
    validateClientScope(client, scope);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid client or parameters';
    if (msg.includes('Scope')) {
      return c.redirect(
        `${redirectUri}?error=invalid_scope&error_description=${encodeURIComponent(msg)}${state ? `&state=${encodeURIComponent(state)}` : ''}`
      );
    }
    return c.text(msg, 400);
  }

  if (responseType !== 'code') {
    return c.redirect(
      `${redirectUri}?error=unsupported_response_type&error_description=${encodeURIComponent('Only code response_type is supported')}${state ? `&state=${encodeURIComponent(state)}` : ''}`
    );
  }

  if (!codeChallenge) {
    return c.redirect(
      `${redirectUri}?error=invalid_request&error_description=${encodeURIComponent('PKCE code_challenge is required')}${state ? `&state=${encodeURIComponent(state)}` : ''}`
    );
  }

  if (codeChallengeMethod !== 'S256') {
    return c.redirect(
      `${redirectUri}?error=invalid_request&error_description=${encodeURIComponent("Only 'S256' code_challenge_method is supported")}${state ? `&state=${encodeURIComponent(state)}` : ''}`
    );
  }

  // Check login state
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  let sessionData = null;
  if (sessionId) {
    sessionData = await validateSession(c.env.DB, sessionId);
  }

  if (!sessionData) {
    // Redirect to login with return_to
    const returnTo = c.req.url;
    return c.redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  const requestedScopes = scope.trim().split(/\s+/);
  const csrfToken = await generateCsrfToken(sessionData.session.id, c.env.SESSION_SECRET);

  return c.html(
    ConsentView({
      siteName: c.env.SITE_NAME,
      clientName: client.client_name,
      userEmail: sessionData.user.email,
      scopes: requestedScopes,
      clientId,
      redirectUri,
      scopeString: scope,
      codeChallenge,
      codeChallengeMethod,
      state,
      nonce,
      csrfToken,
    })
  );
});

// POST /oauth/consent
oauthRoutes.post('/oauth/consent', async (c) => {
  const body = await c.req.parseBody();
  const decision = (body.decision as string) || 'deny';
  const clientId = (body.client_id as string) || '';
  const redirectUri = (body.redirect_uri as string) || '';
  const scope = (body.scope as string) || 'openid';
  const codeChallenge = (body.code_challenge as string) || '';
  const codeChallengeMethod = (body.code_challenge_method as string) || 'S256';
  const state = (body.state as string) || undefined;
  const nonce = (body.nonce as string) || undefined;
  const submittedCsrf = (body._csrf as string) || '';

  // Validate session
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return c.redirect('/login');
  }

  const sessionData = await validateSession(c.env.DB, sessionId);
  if (!sessionData) {
    return c.redirect('/login');
  }

  // Validate CSRF token
  const isCsrfValid = await verifyCsrfToken(submittedCsrf, sessionId, c.env.SESSION_SECRET);
  if (!isCsrfValid) {
    return c.text('Invalid or missing CSRF token', 403);
  }

  // Validate client & redirectUri & scope
  let client;
  try {
    client = await validateClient(c.env.DB, clientId, undefined, redirectUri);
    validateClientScope(client, scope);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid client or parameters';
    if (msg.includes('Scope')) {
      const errorUrl = new URL(redirectUri);
      errorUrl.searchParams.set('error', 'invalid_scope');
      errorUrl.searchParams.set('error_description', msg);
      if (state) errorUrl.searchParams.set('state', state);
      return c.redirect(errorUrl.toString());
    }
    return c.text(msg, 400);
  }

  // If user denied
  if (decision === 'deny') {
    const errorUrl = new URL(redirectUri);
    errorUrl.searchParams.set('error', 'access_denied');
    errorUrl.searchParams.set('error_description', 'User denied authorization request');
    if (state) errorUrl.searchParams.set('state', state);
    return c.redirect(errorUrl.toString());
  }

  // User allowed -> create authorization code
  const { code } = await createAuthorizationCode(c.env.DB, {
    clientId,
    userId: sessionData.user.id,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod,
    nonce,
  });

  const successUrl = new URL(redirectUri);
  successUrl.searchParams.set('code', code);
  if (state) successUrl.searchParams.set('state', state);

  return c.redirect(successUrl.toString());
});

// POST /oauth/token
oauthRoutes.post('/oauth/token', async (c) => {
  c.header('Cache-Control', 'no-store');
  c.header('Pragma', 'no-cache');

  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.parseBody()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const { clientId, clientSecret } = parseClientCredentials(c, body);
  const grantType = (body.grant_type as string) || '';

  if (!clientId) {
    return c.json(
      { error: 'invalid_client', error_description: 'client_id is required' },
      400
    );
  }

  try {
    if (grantType === 'authorization_code') {
      const code = (body.code as string) || '';
      const redirectUri = (body.redirect_uri as string) || '';
      const codeVerifier = (body.code_verifier as string) || '';

      if (!code || !redirectUri || !codeVerifier) {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Missing code, redirect_uri, or code_verifier',
          },
          400
        );
      }

      const tokenRes = await exchangeAuthorizationCode(c.env.DB, {
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier,
      });

      const responsePayload: Record<string, unknown> = {
        access_token: tokenRes.access_token,
        token_type: tokenRes.token_type,
        expires_in: tokenRes.expires_in,
        refresh_token: tokenRes.refresh_token,
        scope: tokenRes.scope,
      };

      // If scope includes 'openid', append id_token
      if (tokenRes.scope.split(' ').includes('openid')) {
        const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
          .bind(tokenRes.user_id)
          .first<any>();

        if (user) {
          const idToken = await generateIdToken(c.env, {
            clientId,
            user,
            scope: tokenRes.scope,
            nonce: tokenRes.nonce || undefined,
          });
          responsePayload.id_token = idToken;
        }
      }

      return c.json(responsePayload);
    } else if (grantType === 'refresh_token') {
      const refreshToken = (body.refresh_token as string) || '';
      const scope = (body.scope as string) || undefined;

      if (!refreshToken) {
        return c.json(
          { error: 'invalid_request', error_description: 'Missing refresh_token' },
          400
        );
      }

      const refreshed = await refreshAccessToken(c.env.DB, {
        clientId,
        clientSecret,
        refreshToken,
        scope,
      });

      return c.json({
        access_token: refreshed.access_token,
        token_type: refreshed.token_type,
        expires_in: refreshed.expires_in,
        refresh_token: refreshed.refresh_token,
        scope: refreshed.scope,
      });
    } else {
      return c.json(
        {
          error: 'unsupported_grant_type',
          error_description: `Grant type '${grantType}' is not supported`,
        },
        400
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Token exchange failed';
    return c.json({ error: 'invalid_grant', error_description: errorMsg }, 400);
  }
});

// POST /oauth/revoke
oauthRoutes.post('/oauth/revoke', async (c) => {
  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.parseBody()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const { clientId, clientSecret } = parseClientCredentials(c, body);
  const token = (body.token as string) || '';

  if (!clientId || !token) {
    return c.json(
      { error: 'invalid_request', error_description: 'Missing clientId or token' },
      400
    );
  }

  try {
    await revokeToken(c.env.DB, {
      clientId,
      clientSecret,
      token,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Revocation failed';
    return c.json({ error: 'invalid_request', error_description: errorMsg }, 400);
  }

  return c.json({ success: true }, 200);
});
