import { Hono } from 'hono';
import type { AppContext } from '../types/env';
import {
  getOpenIdConfiguration,
  getJwks,
  getUserInfoClaims,
} from '../services/oidc.service';
import { validateAccessToken } from '../services/oauth.service';
import type { User } from '../db/schema';
import { queryFirst } from '../db/client';

export const oidcRoutes = new Hono<AppContext>();

// GET /.well-known/openid-configuration
oidcRoutes.get('/.well-known/openid-configuration', (c) => {
  const issuer = c.env?.AUTH_URL || new URL(c.req.url).origin;
  const config = getOpenIdConfiguration(issuer);
  return c.json(config);
});

// GET /.well-known/jwks.json
oidcRoutes.get('/.well-known/jwks.json', async (c) => {
  const jwks = await getJwks(c.env);
  return c.json(jwks);
});

// Handler for UserInfo (GET & POST)
const handleUserInfo = async (c: any) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    c.header('WWW-Authenticate', 'Bearer error="invalid_token", error_description="Missing access token"');
    return c.json({ error: 'invalid_token', error_description: 'Missing access token' }, 401);
  }

  const accessToken = authHeader.substring(7).trim();
  const tokenValidation = await validateAccessToken(c.env.DB, accessToken);

  if (!tokenValidation || !tokenValidation.isValid) {
    c.header('WWW-Authenticate', 'Bearer error="invalid_token", error_description="Invalid or expired access token"');
    return c.json({ error: 'invalid_token', error_description: 'Invalid or expired access token' }, 401);
  }

  const user = await queryFirst<User>(
    c.env.DB,
    'SELECT * FROM users WHERE id = ?',
    tokenValidation.token.user_id
  );

  if (!user || user.is_active !== 1) {
    c.header('WWW-Authenticate', 'Bearer error="invalid_token", error_description="User account disabled"');
    return c.json({ error: 'invalid_token', error_description: 'User not found or disabled' }, 401);
  }

  const claims = getUserInfoClaims(user, tokenValidation.token.scope);
  return c.json(claims);
};

oidcRoutes.get('/oauth/userinfo', handleUserInfo);
oidcRoutes.post('/oauth/userinfo', handleUserInfo);
