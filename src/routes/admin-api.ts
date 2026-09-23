import { Hono } from 'hono';
import type { AppContext } from '../types/env';
import { adminAuthMiddleware } from '../middlewares/admin-auth';
import {
  getDashboardStats,
  listUsers,
  updateUserStatus,
  deleteUser,
  listClients,
  createClient,
  rotateClientSecret,
  deleteClient,
} from '../services/admin.service';
import { revokeAllUserSessions } from '../services/session.service';

export const adminApiRoutes = new Hono<AppContext>();

// Require admin authentication on all /api/admin/* routes
adminApiRoutes.use('/api/admin/*', adminAuthMiddleware);

// GET /api/admin/stats
adminApiRoutes.get('/api/admin/stats', async (c) => {
  const stats = await getDashboardStats(c.env.DB);
  return c.json(stats);
});

// GET /api/admin/users
adminApiRoutes.get('/api/admin/users', async (c) => {
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : 0;
  const search = c.req.query('search') || undefined;

  const result = await listUsers(c.env.DB, { limit, offset, search });
  return c.json(result);
});

// PATCH /api/admin/users/:id
adminApiRoutes.patch('/api/admin/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as {
    is_active?: number;
    email_verified?: number;
    is_admin?: number;
  };

  try {
    const updated = await updateUserStatus(c.env.DB, id, body);
    return c.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update user';
    return c.json({ error: msg }, 400);
  }
});

// DELETE /api/admin/users/:id
adminApiRoutes.delete('/api/admin/users/:id', async (c) => {
  const id = c.req.param('id');
  const currentAdmin = c.get('user');

  try {
    await deleteUser(c.env.DB, id, currentAdmin?.id);
    return c.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete user';
    return c.json({ error: msg }, 400);
  }
});

// POST /api/admin/users/:id/revoke-sessions
adminApiRoutes.post('/api/admin/users/:id/revoke-sessions', async (c) => {
  const id = c.req.param('id');
  await revokeAllUserSessions(c.env.DB, id);
  return c.json({ success: true });
});

// GET /api/admin/clients
adminApiRoutes.get('/api/admin/clients', async (c) => {
  const clients = await listClients(c.env.DB);
  return c.json({ clients });
});

// POST /api/admin/clients
adminApiRoutes.post('/api/admin/clients', async (c) => {
  const body = (await c.req.json()) as {
    name: string;
    redirect_uris: string[];
    allowed_scopes?: string[];
    is_public?: boolean;
  };

  try {
    const result = await createClient(c.env.DB, {
      name: body.name,
      redirectUris: body.redirect_uris,
      allowedScopes: body.allowed_scopes,
      isPublic: body.is_public,
    });
    return c.json(result, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create client';
    return c.json({ error: msg }, 400);
  }
});

// POST /api/admin/clients/:id/rotate-secret
adminApiRoutes.post('/api/admin/clients/:id/rotate-secret', async (c) => {
  const id = c.req.param('id');

  try {
    const result = await rotateClientSecret(c.env.DB, id);
    return c.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rotate client secret';
    return c.json({ error: msg }, 400);
  }
});

// DELETE /api/admin/clients/:id
adminApiRoutes.delete('/api/admin/clients/:id', async (c) => {
  const id = c.req.param('id');

  try {
    await deleteClient(c.env.DB, id);
    return c.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete client';
    return c.json({ error: msg }, 400);
  }
});
