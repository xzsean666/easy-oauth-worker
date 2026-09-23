import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppContext } from '../types/env';
import { SESSION_COOKIE_NAME } from './auth';
import { validateSession, revokeAllUserSessions } from '../services/session.service';
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
  await next();
}

// GET /admin
adminWebRoutes.get('/admin', async (c) => {
  const admin = c.get('user');
  const stats = await getDashboardStats(c.env.DB);

  return c.html(
    DashboardView({
      stats,
      adminEmail: admin?.email,
      siteName: c.env.SITE_NAME,
    })
  );
});

// GET /admin/users
adminWebRoutes.get('/admin/users', async (c) => {
  const admin = c.get('user');
  const search = c.req.query('search') || undefined;
  const message = c.req.query('message') || undefined;

  const result = await listUsers(c.env.DB, { search });

  return c.html(
    UsersView({
      users: result.users,
      total: result.total,
      search,
      adminEmail: admin?.email,
      siteName: c.env.SITE_NAME,
      message,
    })
  );
});

// POST /admin/users/:id/action
adminWebRoutes.post('/admin/users/:id/action', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const action = (body.action as string) || '';

  if (action === 'toggle_active') {
    const userRow = await c.env.DB.prepare('SELECT is_active FROM users WHERE id = ?')
      .bind(id)
      .first<{ is_active: number }>();
    if (userRow) {
      const nextActive = userRow.is_active === 1 ? 0 : 1;
      await updateUserStatus(c.env.DB, id, { is_active: nextActive });
    }
  } else if (action === 'verify_email') {
    await updateUserStatus(c.env.DB, id, { email_verified: 1 });
  } else if (action === 'revoke_sessions') {
    await revokeAllUserSessions(c.env.DB, id);
  }

  return c.redirect('/admin/users?message=User+action+completed');
});

// GET /admin/clients
adminWebRoutes.get('/admin/clients', async (c) => {
  const admin = c.get('user');
  const newSecret = c.req.query('new_secret');
  const newClientId = c.req.query('client_id');
  const message = c.req.query('message');
  const error = c.req.query('error');

  const clients = await listClients(c.env.DB);

  return c.html(
    ClientsView({
      clients,
      adminEmail: admin?.email,
      siteName: c.env.SITE_NAME,
      newSecretInfo: newSecret && newClientId ? { clientId: newClientId, secret: newSecret } : undefined,
      message,
      error,
    })
  );
});

// POST /admin/clients
adminWebRoutes.post('/admin/clients', async (c) => {
  const body = await c.req.parseBody();
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
      name,
      redirectUris,
      allowedScopes,
      isPublic,
    });

    return c.redirect(
      `/admin/clients?client_id=${result.client.client_id}&new_secret=${result.plainSecret}`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create client';
    return c.redirect(`/admin/clients?error=${encodeURIComponent(msg)}`);
  }
});

// POST /admin/clients/:id/rotate
adminWebRoutes.post('/admin/clients/:id/rotate', async (c) => {
  const id = c.req.param('id');
  try {
    const result = await rotateClientSecret(c.env.DB, id);
    return c.redirect(
      `/admin/clients?client_id=${id}&new_secret=${result.newSecret}`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rotate client secret';
    return c.redirect(`/admin/clients?error=${encodeURIComponent(msg)}`);
  }
});

// POST /admin/clients/:id/delete
adminWebRoutes.post('/admin/clients/:id/delete', async (c) => {
  const id = c.req.param('id');
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
      adminEmail: admin?.email,
      siteName: c.env.SITE_NAME,
      authUrl: c.env.AUTH_URL,
      smtpHost: c.env.SMTP_HOST,
      smtpPort: c.env.SMTP_PORT,
      smtpUsername: c.env.SMTP_USERNAME,
    })
  );
});
