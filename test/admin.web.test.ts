import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { registerUser } from '../src/services/auth.service';
import { createSession } from '../src/services/session.service';
import { execute, queryFirst } from '../src/db/client';
import { generateCsrfToken } from '../src/crypto/csrf';
import type { Bindings } from '../src/types/env';
import type { User, OAuthClient } from '../src/db/schema';

describe('Admin Web UI Integration Tests', () => {
  let db: MockD1Database;
  let mockEnv: Bindings;
  let adminId: string;
  let adminEmail: string;
  let adminSessionId: string;
  let regularUserId: string;
  let regularSessionId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    mockEnv = {
      DB: db,
      AUTH_URL: 'http://localhost:8787',
      SITE_NAME: 'EasyOAuth Admin Test',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USERNAME: 'sender@gmail.com',
    };

    // 1. Admin user
    adminEmail = 'superadmin@example.com';
    const { user: aUser } = await registerUser(db, adminEmail, 'SuperAdmin123!');
    adminId = aUser.id;
    await execute(db, 'UPDATE users SET is_admin = 1, email_verified = 1 WHERE id = ?', adminId);
    const aSess = await createSession(db, adminId);
    adminSessionId = aSess.id;

    // 2. Regular user
    const { user: rUser } = await registerUser(db, 'normaluser@example.com', 'NormalUser123!');
    regularUserId = rUser.id;
    const rSess = await createSession(db, regularUserId);
    regularSessionId = rSess.id;
  });

  describe('Route Access Control', () => {
    it('redirects unauthenticated visitors to /login', async () => {
      const res = await app.request('/admin', {}, mockEnv);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('/login?return_to=');
    });

    it('returns 403 Forbidden to authenticated non-admin users', async () => {
      const res = await app.request(
        '/admin',
        {
          headers: { Cookie: `easy_session=${regularSessionId}` },
        },
        mockEnv
      );
      expect(res.status).toBe(403);
      const html = await res.text();
      expect(html).toContain('403 Forbidden');
    });
  });

  describe('Admin Dashboard', () => {
    it('renders overview dashboard cards with metrics', async () => {
      const res = await app.request(
        '/admin',
        {
          headers: { Cookie: `easy_session=${adminSessionId}` },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Dashboard');
      expect(html).toContain('Total Users');
      expect(html).toContain('Active Sessions');
      expect(html).toContain(adminEmail);
    });
  });

  describe('Users Management UI', () => {
    it('renders users table and toggles user active state via form POST', async () => {
      // GET /admin/users
      const getRes = await app.request(
        '/admin/users',
        {
          headers: { Cookie: `easy_session=${adminSessionId}` },
        },
        mockEnv
      );
      expect(getRes.status).toBe(200);
      const html = await getRes.text();
      expect(html).toContain('normaluser@example.com');

      // POST /admin/users/:id/action (toggle_active)
      const csrfToken = await generateCsrfToken(adminSessionId);
      const postRes = await app.request(
        `/admin/users/${regularUserId}/action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: `action=toggle_active&_csrf=${csrfToken}`,
        },
        mockEnv
      );

      expect(postRes.status).toBe(302);
      expect(postRes.headers.get('Location')).toContain('/admin/users');

      // Check DB: regular user should now be is_active = 0
      const updatedUser = await queryFirst<User>(db, 'SELECT is_active FROM users WHERE id = ?', regularUserId);
      expect(updatedUser?.is_active).toBe(0);
    });

    it('manually verifies email via form POST', async () => {
      const csrfToken = await generateCsrfToken(adminSessionId);
      const postRes = await app.request(
        `/admin/users/${regularUserId}/action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: `action=verify_email&_csrf=${csrfToken}`,
        },
        mockEnv
      );

      expect(postRes.status).toBe(302);
      const updatedUser = await queryFirst<User>(db, 'SELECT email_verified FROM users WHERE id = ?', regularUserId);
      expect(updatedUser?.email_verified).toBe(1);
    });
  });

  describe('OAuth Clients UI', () => {
    it('renders clients view and creates new client via form POST using secure Flash Cookie', async () => {
      const csrfToken = await generateCsrfToken(adminSessionId);
      // POST /admin/clients
      const formData = new URLSearchParams({
        name: 'Dashboard Registered Client',
        redirect_uris: 'https://client.example.com/cb\nhttps://client.example.com/alt',
        allowed_scopes: 'openid email profile',
        _csrf: csrfToken,
      });

      const postRes = await app.request(
        '/admin/clients',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(postRes.status).toBe(302);
      const location = postRes.headers.get('Location')!;
      // URL MUST NOT leak secret
      expect(location).toBe('/admin/clients');
      expect(location).not.toContain('new_secret=');

      // Secret is passed via secure Flash Cookie
      const setCookieHeader = postRes.headers.get('Set-Cookie')!;
      expect(setCookieHeader).toContain('admin_flash_secret=');

      const flashCookie = setCookieHeader.split(';')[0];

      // Follow redirect to GET /admin/clients with flash cookie
      const getRes = await app.request(
        '/admin/clients',
        {
          headers: { Cookie: `easy_session=${adminSessionId}; ${flashCookie}` },
        },
        mockEnv
      );
      expect(getRes.status).toBe(200);
      const html = await getRes.text();
      expect(html).toContain('Copy New Client Secret Now');
      expect(html).toContain('Dashboard Registered Client');
    });

    it('rotates client secret via form POST using secure Flash Cookie', async () => {
      // Seed client
      await execute(
        db,
        `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        'client_to_rotate',
        'old_secret_value',
        'App to Rotate',
        JSON.stringify(['https://example.com']),
        JSON.stringify(['openid']),
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      );

      const csrfToken = await generateCsrfToken(adminSessionId);
      const rotateRes = await app.request(
        '/admin/clients/client_to_rotate/rotate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: `_csrf=${csrfToken}`,
        },
        mockEnv
      );

      expect(rotateRes.status).toBe(302);
      expect(rotateRes.headers.get('Location')).toBe('/admin/clients');
      expect(rotateRes.headers.get('Set-Cookie')).toContain('admin_flash_secret=');

      const updated = await queryFirst<OAuthClient>(db, 'SELECT client_secret FROM oauth_clients WHERE client_id = ?', 'client_to_rotate');
      expect(updated?.client_secret).not.toBe('old_secret_value');
    });
  });

  describe('Settings UI', () => {
    it('renders provider settings and SMTP details', async () => {
      const res = await app.request(
        '/admin/settings',
        {
          headers: { Cookie: `easy_session=${adminSessionId}` },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('System Settings');
      expect(html).toContain('Identity &amp; OIDC Endpoints');
      expect(html).toContain('Gmail SMTP Gateway');
      expect(html).toContain('smtp.gmail.com');
      expect(html).toContain('PBKDF2-SHA256');
    });
  });
});
