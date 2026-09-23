import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { registerUser } from '../src/services/auth.service';
import { createSession, validateSession } from '../src/services/session.service';
import { execute } from '../src/db/client';
import {
  getDashboardStats,
  listUsers,
  updateUserStatus,
  deleteUser,
  createClient,
  rotateClientSecret,
  deleteClient,
} from '../src/services/admin.service';
import type { Bindings } from '../src/types/env';

describe('Admin Service and Admin API Tests', () => {
  let db: MockD1Database;
  let mockEnv: Bindings;
  let adminId: string;
  let adminSessionId: string;
  let regularUserId: string;
  let regularSessionId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    mockEnv = {
      DB: db,
      AUTH_URL: 'http://localhost:8787',
      SITE_NAME: 'EasyOAuth Admin Test',
    };

    // 1. Create Admin user
    const { user: adminUser } = await registerUser(db, 'admin@example.com', 'AdminPass123!');
    adminId = adminUser.id;
    await execute(db, 'UPDATE users SET is_admin = 1, email_verified = 1 WHERE id = ?', adminId);
    const adminSess = await createSession(db, adminId);
    adminSessionId = adminSess.id;

    // 2. Create Regular user
    const { user: regUser } = await registerUser(db, 'regular@example.com', 'RegularPass123!');
    regularUserId = regUser.id;
    const regSess = await createSession(db, regularUserId);
    regularSessionId = regSess.id;
  });

  describe('Admin Authorization Middleware', () => {
    it('returns 401 when accessing admin API without credentials', async () => {
      const res = await app.request('/api/admin/stats', {}, mockEnv);
      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('unauthorized');
    });

    it('returns 403 when regular user attempts to access admin API', async () => {
      const res = await app.request(
        '/api/admin/stats',
        {
          headers: { Cookie: `easy_session=${regularSessionId}` },
        },
        mockEnv
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('forbidden');
    });

    it('grants access to admin API with valid admin session', async () => {
      const res = await app.request(
        '/api/admin/stats',
        {
          headers: { Cookie: `easy_session=${adminSessionId}` },
        },
        mockEnv
      );
      expect(res.status).toBe(200);
      const stats = (await res.json()) as { totalUsers: number };
      expect(stats.totalUsers).toBe(2);
    });
  });

  describe('Dashboard Metrics', () => {
    it('calculates metrics accurately', async () => {
      // Create a test client
      await createClient(db, {
        name: 'Dashboard Client',
        redirectUris: ['https://example.com/cb'],
      });

      const stats = await getDashboardStats(db);
      expect(stats.totalUsers).toBe(2);
      expect(stats.verifiedUsers).toBe(1); // admin is verified, regular is not
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalClients).toBe(1);
    });
  });

  describe('User Administration', () => {
    it('lists users and supports search filtering', async () => {
      const all = await listUsers(db);
      expect(all.total).toBe(2);
      expect(all.users.length).toBe(2);
      // Ensure passwords are not exposed
      expect((all.users[0] as any).password_hash).toBeUndefined();

      const filtered = await listUsers(db, { search: 'reg' });
      expect(filtered.total).toBe(1);
      expect(filtered.users[0].email).toBe('regular@example.com');
    });

    it('updates user status and automatically revokes sessions when deactivated', async () => {
      // Regular user has active session
      expect(await validateSession(db, regularSessionId)).not.toBeNull();

      // Deactivate user
      const updated = await updateUserStatus(db, regularUserId, { is_active: 0 });
      expect(updated.is_active).toBe(0);

      // Session should have been revoked
      expect(await validateSession(db, regularSessionId)).toBeNull();
    });

    it('prevents administrator from deleting their own account', async () => {
      await expect(deleteUser(db, adminId, adminId)).rejects.toThrow(
        'cannot delete your own administrator account'
      );
    });

    it('deletes user successfully', async () => {
      const res = await deleteUser(db, regularUserId, adminId);
      expect(res).toBe(true);

      const check = await listUsers(db);
      expect(check.total).toBe(1);
    });
  });

  describe('OAuth Client Management via API', () => {
    it('creates, lists, rotates secret, and deletes client via API', async () => {
      // 1. POST /api/admin/clients
      const createRes = await app.request(
        '/api/admin/clients',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: JSON.stringify({
            name: 'API Client App',
            redirect_uris: ['https://app.com/callback'],
            allowed_scopes: ['openid', 'email'],
            is_public: false,
          }),
        },
        mockEnv
      );

      expect(createRes.status).toBe(201);
      const createData = (await createRes.json()) as { client: any; plainSecret: string };
      expect(createData.client.client_name).toBe('API Client App');
      expect(createData.plainSecret).toBeDefined();
      const newClientId = createData.client.client_id;

      // 2. GET /api/admin/clients
      const listRes = await app.request(
        '/api/admin/clients',
        {
          headers: { Cookie: `easy_session=${adminSessionId}` },
        },
        mockEnv
      );
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()) as { clients: any[] };
      expect(listData.clients.length).toBe(1);

      // 3. POST /api/admin/clients/:id/rotate-secret
      const rotateRes = await app.request(
        `/api/admin/clients/${newClientId}/rotate-secret`,
        {
          method: 'POST',
          headers: { Cookie: `easy_session=${adminSessionId}` },
        },
        mockEnv
      );
      expect(rotateRes.status).toBe(200);
      const rotateData = (await rotateRes.json()) as { newSecret: string };
      expect(rotateData.newSecret).toBeDefined();
      expect(rotateData.newSecret).not.toBe(createData.plainSecret);

      // 4. DELETE /api/admin/clients/:id
      const delRes = await app.request(
        `/api/admin/clients/${newClientId}`,
        {
          method: 'DELETE',
          headers: { Cookie: `easy_session=${adminSessionId}` },
        },
        mockEnv
      );
      expect(delRes.status).toBe(200);
    });
  });
});
