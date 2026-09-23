import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext, Bindings } from './types/env';
import { authRoutes } from './routes/auth';
import { oauthRoutes } from './routes/oauth';
import { oidcRoutes } from './routes/oidc';
import { adminApiRoutes } from './routes/admin-api';
import { adminWebRoutes } from './routes/admin-web';

const app = new Hono<AppContext>();

// 1. Security Headers Middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// 2. CORS Middleware for public OIDC and OAuth discovery/token/userinfo/revoke endpoints
const corsHandler = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'Cache-Control', 'Pragma'],
  maxAge: 86400,
});

app.use('/.well-known/*', corsHandler);
app.use('/oauth/token', corsHandler);
app.use('/oauth/userinfo', corsHandler);
app.use('/oauth/revoke', corsHandler);

// 3. Error and 404 Handlers
app.notFound((c) => {
  const isApi =
    c.req.path.startsWith('/api/') ||
    c.req.path.startsWith('/oauth/') ||
    c.req.path.startsWith('/.well-known/');
  if (isApi) {
    return c.json({ error: 'not_found', message: 'The requested resource was not found' }, 404);
  }
  return c.text('404 Not Found', 404);
});

app.onError((err, c) => {
  console.error('[easy-oauth-worker error]', err);
  const isApi =
    c.req.path.startsWith('/api/') ||
    c.req.path.startsWith('/oauth/') ||
    c.req.path.startsWith('/.well-known/');
  if (isApi) {
    return c.json(
      { error: 'server_error', message: err.message || 'An unexpected error occurred' },
      500
    );
  }
  return c.text('500 Internal Server Error', 500);
});

// 4. Basic Routes
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'easy-oauth-worker',
  });
});

app.get('/', (c) => {
  return c.text('easy-oauth-worker is running');
});

app.route('/', authRoutes);
app.route('/', oauthRoutes);
app.route('/', oidcRoutes);
app.route('/', adminApiRoutes);
app.route('/', adminWebRoutes);

/**
 * Periodically purges expired sessions, spent authorization codes,
 * expired verification tokens, and revoked tokens.
 */
export async function cleanupExpiredData(db: D1Database): Promise<{
  sessionsDeleted: number;
  codesDeleted: number;
  tokensDeleted: number;
  verificationTokensDeleted: number;
}> {
  const now = Math.floor(Date.now() / 1000);

  const resSessions = await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  const resCodes = await db
    .prepare('DELETE FROM oauth_authorization_codes WHERE expires_at < ? OR used = 1')
    .bind(now)
    .run();
  const resVerification = await db
    .prepare('DELETE FROM verification_tokens WHERE expires_at < ? OR used = 1')
    .bind(now)
    .run();
  // Purge tokens that are:
  // 1. Explicitly revoked
  // 2. Expired access tokens without a refresh token
  // 3. Tokens where refresh token exceeded maximum 30-day lifetime
  const MAX_REFRESH_LIFETIME = 30 * 24 * 3600;
  const resTokens = await db
    .prepare(
      `DELETE FROM oauth_tokens 
       WHERE revoked = 1 
          OR (refresh_token IS NULL AND expires_at < ?) 
          OR (created_at + ? < ?)`
    )
    .bind(now, MAX_REFRESH_LIFETIME, now)
    .run();

  return {
    sessionsDeleted: Number(resSessions.meta.changes ?? 0),
    codesDeleted: Number(resCodes.meta.changes ?? 0),
    tokensDeleted: Number(resTokens.meta.changes ?? 0),
    verificationTokensDeleted: Number(resVerification.meta.changes ?? 0),
  };
}

export { app };

export default Object.assign(app, {
  async scheduled(event: any, env: Bindings, ctx: any) {
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(cleanupExpiredData(env.DB));
    } else {
      await cleanupExpiredData(env.DB);
    }
  },
});
