import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppContext } from '../types/env';
import { SESSION_COOKIE_NAME } from './auth';
import { validateSession, revokeAllUserSessions } from '../services/session.service';
import { generateCsrfToken, verifyCsrfToken } from '../crypto/csrf';
import {
  getDashboardStats,
  listUsers,
  updateUserStatus,
  listClients,
  createClient,
  rotateClientSecret,
  deleteClient,
} from '../services/admin.service';
import { Layout } from '../views/layout';
import { DashboardView } from '../views/admin/dashboard';
import { UsersView } from '../views/admin/users';
import { ClientsView } from '../views/admin/clients';
import { SettingsView } from '../views/admin/settings';

export const adminWebRoutes = new Hono<AppContext>();

// Admin Web Authentication Middleware
adminWebRoutes.use('/admin', async (c, next) => {
  return handleAdminWebAuth(c, next);
});

adminWebRoutes.use('/admin/*', async (c, next) => {
  return handleAdminWebAuth(c, next);
});

async function handleAdminWebAuth(c: any, next: any) {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return c.redirect(`/login?return_to=${encodeURIComponent(c.req.url)}`);
  }

  const sessionData = await validateSession(c.env.DB, sessionId);
  if (!sessionData) {
    return c.redirect(`/login?return_to=${encodeURIComponent(c.req.url)}`);
  }

  if (sessionData.user.is_admin !== 1) {
    c.status(403);
    return c.html(
      Layout({
        title: 'Access Denied',
        siteName: c.env.SITE_NAME,
        children: (
          <div class="text-center space-y-4">
            <div class="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ⛔
            </div>
            <h2 class="text-xl font-bold text-white">403 Forbidden</h2>
            <p class="text-sm text-slate-300">
              Administrator privileges are required to access the console.
            </p>
            <a
              href="/"
              class="inline-block py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              Return Home
            </a>
          </div>
        ),
      })
    );
  }

  c.set('user', sessionData.user);
  c.set('session', sessionData.session);

  const csrfToken = await generateCsrfToken(sessionData.session.id, c.env.SESSION_SECRET);
  c.set('csrfToken', csrfToken as any);

  await next();
}

// GET /admin
adminWebRoutes.get('/admin', async (c) => {
  const admin = c.get('user');
  const stats = await getDashboardStats(c.env.DB);

  return c.html(
    DashboardView({
      stats,
      adminUsername: admin?.username,
      siteName: c.env.SITE_NAME,
    })
  );
});

// GET /admin/users
adminWebRoutes.get('/admin/users', async (c) => {
  const admin = c.get('user');
  const search = c.req.query('search') || undefined;
  const message = c.req.query('message') || undefined;
  const csrfToken = (c.get as any)('csrfToken');

  const result = await listUsers(c.env.DB, { search });

  return c.html(
    UsersView({
      users: result.users,
      total: result.total,
      search,
      adminUsername: admin?.username,
      siteName: c.env.SITE_NAME,
      message,
      csrfToken,
    })
  );
});

// POST /admin/users/:id/action
adminWebRoutes.post('/admin/users/:id/action', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const isCsrfValid = await verifyCsrfToken(body._csrf as string, sessionId, c.env.SESSION_SECRET);
  if (!isCsrfValid) {
    return c.text('Invalid or missing CSRF token', 403);
  }

  const currentAdmin = c.get('user');
  const action = (body.action as string) || '';

  try {
    if (action === 'toggle_active') {
      const userRow = await c.env.DB.prepare('SELECT is_active FROM users WHERE id = ?')
        .bind(id)
        .first<{ is_active: number }>();
      if (userRow) {
        const nextActive = userRow.is_active === 1 ? 0 : 1;
        await updateUserStatus(c.env.DB, id, { is_active: nextActive }, currentAdmin?.id);
      }
    } else if (action === 'revoke_sessions') {
      await revokeAllUserSessions(c.env.DB, id);
    } else if (action === 'reset_totp') {
      await c.env.DB.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0, updated_at = ? WHERE id = ?')
        .bind(Math.floor(Date.now() / 1000), id)
        .run();
    }
    return c.redirect('/admin/users?message=User+action+completed');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'User action failed';
    return c.redirect(`/admin/users?message=${encodeURIComponent(msg)}`);
  }
});

// GET /admin/clients
adminWebRoutes.get('/admin/clients', async (c) => {
  const admin = c.get('user');
  const message = c.req.query('message');
  const error = c.req.query('error');
  const csrfToken = (c.get as any)('csrfToken');

  // Flash cookie retrieval
  let flashSecretInfo: { clientId: string; secret: string } | undefined;
  const flashCookie = getCookie(c, 'admin_flash_secret');
  if (flashCookie) {
    try {
      flashSecretInfo = JSON.parse(flashCookie);
    } catch {}
    deleteCookie(c, 'admin_flash_secret', { path: '/admin' });
  }

  // Fallback to query param if not in cookie
  const newSecret = c.req.query('new_secret');
  const newClientId = c.req.query('client_id');
  const finalSecretInfo = flashSecretInfo || (newSecret && newClientId ? { clientId: newClientId, secret: newSecret } : undefined);

  const clients = await listClients(c.env.DB);

  return c.html(
    ClientsView({
      clients,
      adminUsername: admin?.username,
      siteName: c.env.SITE_NAME,
      newSecretInfo: finalSecretInfo,
      message,
      error,
      csrfToken,
    })
  );
});

// POST /admin/clients
adminWebRoutes.post('/admin/clients', async (c) => {
  const body = await c.req.parseBody();
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const isCsrfValid = await verifyCsrfToken(body._csrf as string, sessionId, c.env.SESSION_SECRET);
  if (!isCsrfValid) {
    return c.text('Invalid or missing CSRF token', 403);
  }

  const name = (body.name as string) || '';
  const redirectUrisRaw = (body.redirect_uris as string) || '';
  const allowedScopesRaw = (body.allowed_scopes as string) || '';
  const isPublic = body.is_public === 'true' || body.is_public === 'on';

  const redirectUris = redirectUrisRaw
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  const allowedScopes = allowedScopesRaw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    const result = await createClient(c.env.DB, {
      clientName: name,
      redirectUris,
      allowedScopes,
      isPublic,
    });

    // Store secret in secure, short-lived flash cookie
    setCookie(
      c,
      'admin_flash_secret',
      JSON.stringify({ clientId: result.client.client_id, secret: result.secret }),
      {
        httpOnly: true,
        secure: c.req.url.startsWith('https://'),
        path: '/admin',
        sameSite: 'Lax',
        maxAge: 60,
      }
    );

    return c.redirect('/admin/clients');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create client';
    return c.redirect(`/admin/clients?error=${encodeURIComponent(msg)}`);
  }
});

// POST /admin/clients/:id/rotate
adminWebRoutes.post('/admin/clients/:id/rotate', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const isCsrfValid = await verifyCsrfToken(body._csrf as string, sessionId, c.env.SESSION_SECRET);
  if (!isCsrfValid) {
    return c.text('Invalid or missing CSRF token', 403);
  }

  try {
    const result = await rotateClientSecret(c.env.DB, id);

    // Store rotated secret in flash cookie
    setCookie(
      c,
      'admin_flash_secret',
      JSON.stringify({ clientId: id, secret: result.newSecret }),
      {
        httpOnly: true,
        secure: c.req.url.startsWith('https://'),
        path: '/admin',
        sameSite: 'Lax',
        maxAge: 60,
      }
    );

    return c.redirect('/admin/clients');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rotate client secret';
    return c.redirect(`/admin/clients?error=${encodeURIComponent(msg)}`);
  }
});

// POST /admin/clients/:id/delete
adminWebRoutes.post('/admin/clients/:id/delete', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const isCsrfValid = await verifyCsrfToken(body._csrf as string, sessionId, c.env.SESSION_SECRET);
  if (!isCsrfValid) {
    return c.text('Invalid or missing CSRF token', 403);
  }

  try {
    await deleteClient(c.env.DB, id);
    return c.redirect('/admin/clients?message=Client+deleted');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete client';
    return c.redirect(`/admin/clients?error=${encodeURIComponent(msg)}`);
  }
});

// GET /admin/settings
adminWebRoutes.get('/admin/settings', (c) => {
  const admin = c.get('user');

  return c.html(
    SettingsView({
      adminUsername: admin?.username,
      siteName: c.env.SITE_NAME,
      authUrl: c.env.AUTH_URL,
    })
  );
});
