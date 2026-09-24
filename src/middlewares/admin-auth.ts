import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppContext } from '../types/env';
import { SESSION_COOKIE_NAME } from '../routes/auth';
import { validateSession } from '../services/session.service';

export const adminAuthMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  let sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (!sessionId) {
    const authHeader = c.req.header('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      sessionId = authHeader.substring(7).trim();
    }
  }

  if (!sessionId) {
    return c.json({ error: 'unauthorized', message: 'Authentication required' }, 401);
  }

  const sessionData = await validateSession(c.env.DB, sessionId);
  if (!sessionData) {
    return c.json({ error: 'unauthorized', message: 'Invalid or expired session' }, 401);
  }

  if (sessionData.user.is_admin !== 1) {
    return c.json(
      { error: 'forbidden', message: 'Administrator privileges required' },
      403
    );
  }

  c.set('user', {
    id: sessionData.user.id,
    username: sessionData.user.username,
    is_admin: sessionData.user.is_admin,
  });

  c.set('session', {
    id: sessionData.session.id,
    user_id: sessionData.session.user_id,
    expires_at: sessionData.session.expires_at,
  });

  await next();
};
