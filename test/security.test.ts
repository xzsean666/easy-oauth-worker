import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { cleanupExpiredData } from '../src/index';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { registerUser, resetPasswordWithToken, changePassword } from '../src/services/auth.service';
import { createSession } from '../src/services/session.service';
import { updateUserStatus } from '../src/services/admin.service';
import { sendSmtpEmail } from '../src/services/email.service';
import { generateCsrfToken, verifyCsrfToken } from '../src/crypto/csrf';
import { checkRateLimit, resetRateLimit } from '../src/middlewares/rate-limit';
import { execute, queryFirst } from '../src/db/client';
import type { Bindings } from '../src/types/env';
import type { User, OAuthToken } from '../src/db/schema';

describe('TASK-017 Comprehensive Security & Hardening Tests', () => {
  let db: MockD1Database;
  let mockEnv: Bindings;
  let adminId: string;
  let adminSessionId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    mockEnv = {
      DB: db,
      AUTH_URL: 'https://auth.example.com',
      SITE_NAME: 'EasyOAuth Security Test',
      SESSION_SECRET: 'test-secret-salt-12345',
    };

    const { user } = await registerUser(db, 'admin@sec.com', 'AdminPassword123!', { isAdmin: true });
    adminId = user.id;
    await execute(db, 'UPDATE users SET email_verified = 1 WHERE id = ?', adminId);
    const session = await createSession(db, adminId);
    adminSessionId = session.id;
  });

  describe('CSRF Defense Mechanisms', () => {
    it('generates and verifies HMAC-SHA256 session-bound CSRF tokens deterministically', async () => {
      const token1 = await generateCsrfToken('sess_abc', 'my-secret');
      const token2 = await generateCsrfToken('sess_abc', 'my-secret');
      expect(token1).toBe(token2);

      const isValid = await verifyCsrfToken(token1, 'sess_abc', 'my-secret');
      expect(isValid).toBe(true);

      const isInvalidSession = await verifyCsrfToken(token1, 'sess_different', 'my-secret');
      expect(isInvalidSession).toBe(false);

      const isInvalidSecret = await verifyCsrfToken(token1, 'sess_abc', 'wrong-secret');
      expect(isInvalidSecret).toBe(false);

      const isTampered = await verifyCsrfToken('tampered_token', 'sess_abc', 'my-secret');
      expect(isTampered).toBe(false);
    });

    it('rejects POST /oauth/consent when CSRF token is missing or forged', async () => {
      // 1. Missing CSRF
      const missingCsrfRes = await app.request(
        '/oauth/consent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: 'decision=allow&client_id=cid&redirect_uri=https://app.com/cb',
        },
        mockEnv
      );
      expect(missingCsrfRes.status).toBe(403);
      expect(await missingCsrfRes.text()).toContain('Invalid or missing CSRF token');

      // 2. Forged CSRF
      const forgedCsrfRes = await app.request(
        '/oauth/consent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: 'decision=allow&client_id=cid&redirect_uri=https://app.com/cb&_csrf=forged_value',
        },
        mockEnv
      );
      expect(forgedCsrfRes.status).toBe(403);
    });

    it('rejects admin actions when CSRF token is missing', async () => {
      const res = await app.request(
        `/admin/users/${adminId}/action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `easy_session=${adminSessionId}`,
          },
          body: 'action=toggle_active',
        },
        mockEnv
      );
      expect(res.status).toBe(403);
      expect(await res.text()).toContain('Invalid or missing CSRF token');
    });
  });

  describe('Password Length & DoS Defense', () => {
    it('rejects passwords exceeding 128 characters during registration', async () => {
      const giantPassword = 'A'.repeat(129);
      await expect(
        registerUser(db, 'giant@example.com', giantPassword)
      ).rejects.toThrow('Password cannot exceed 128 characters');
    });

    it('accepts passwords up to 128 characters', async () => {
      const maxPassword = 'A'.repeat(128);
      const { user } = await registerUser(db, 'maxpass@example.com', maxPassword);
      expect(user.id).toBeDefined();
    });

    it('rejects passwords exceeding 128 characters during reset and change', async () => {
      const giantPassword = 'B'.repeat(129);
      await expect(
        resetPasswordWithToken(db, 'token_xyz', giantPassword)
      ).rejects.toThrow('Password cannot exceed 128 characters');

      await expect(
        changePassword(db, adminId, 'AdminPassword123!', giantPassword)
      ).rejects.toThrow('Password cannot exceed 128 characters');
    });
  });

  describe('Admin Self-Lockout & Privilege Safeguards', () => {
    it('prevents an administrator from demoting their own admin status', async () => {
      await expect(
        updateUserStatus(db, adminId, { is_admin: 0 }, adminId)
      ).rejects.toThrow('You cannot remove administrator privileges from your own account');
    });

    it('prevents an administrator from disabling their own account', async () => {
      await expect(
        updateUserStatus(db, adminId, { is_active: 0 }, adminId)
      ).rejects.toThrow('You cannot disable your own account');
    });

    it('allows an administrator to update other users without restriction', async () => {
      const { user: otherUser } = await registerUser(db, 'other@sec.com', 'OtherPass123!');
      const updated = await updateUserStatus(db, otherUser.id, { is_admin: 1, is_active: 0 }, adminId);
      expect(updated.is_admin).toBe(1);
      expect(updated.is_active).toBe(0);
    });
  });

  describe('SMTP Command Injection Defense', () => {
    it('throws when fromAddr or to contains CRLF characters', async () => {
      const maliciousEmail = {
        to: 'victim@example.com\r\nDATA\r\nInjected content',
        subject: 'Subject',
        html: '<p>test</p>',
        text: 'test',
      };

      await expect(
        sendSmtpEmail(
          {
            host: 'smtp.gmail.com',
            port: 465,
            username: 'sender@gmail.com',
            password: 'secret',
            from: 'sender@gmail.com',
          },
          maliciousEmail,
          async () => ({} as any)
        )
      ).rejects.toThrow('Invalid email address: CRLF characters detected');
    });
  });

  describe('Token Expiration & Garbage Collection (cleanupExpiredData)', () => {
    it('purges naturally expired standalone access tokens, expired refresh tokens, and revoked tokens', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Seed client
      await execute(
        db,
        `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
         VALUES ('c1', 's1', 'App', '[]', '[]', 0, ?, ?)`,
        now,
        now
      );

      // 1. Expired standalone access token (expires_at in past, no refresh token) -> Should be deleted
      await execute(
        db,
        `INSERT INTO oauth_tokens (id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at)
         VALUES ('t1', 'c1', ?, 'expired_standalone', NULL, 'openid', ?, 0, ?)`,
        adminId,
        now - 3600,
        now - 7200
      );

      // 2. Active access token -> Should NOT be deleted
      await execute(
        db,
        `INSERT INTO oauth_tokens (id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at)
         VALUES ('t2', 'c1', ?, 'active_token', NULL, 'openid', ?, 0, ?)`,
        adminId,
        now + 3600,
        now
      );

      // 3. Expired refresh token (older than 30 days) -> Should be deleted
      await execute(
        db,
        `INSERT INTO oauth_tokens (id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at)
         VALUES ('t3', 'c1', ?, 'token_with_old_refresh', 'refresh_old', 'openid', ?, 0, ?)`,
        adminId,
        now + 3600,
        now - 31 * 86400
      );

      // 4. Revoked token -> Should be deleted
      await execute(
        db,
        `INSERT INTO oauth_tokens (id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at)
         VALUES ('t4', 'c1', ?, 'revoked_token', 'refresh_revoked', 'openid', ?, 1, ?)`,
        adminId,
        now + 3600,
        now
      );

      const result = await cleanupExpiredData(db);
      expect(result.tokensDeleted).toBe(3); // t1, t3, t4 should be deleted

      // Verify t2 is still preserved
      const preserved = await queryFirst<OAuthToken>(db, 'SELECT * FROM oauth_tokens WHERE id = ?', 't2');
      expect(preserved).not.toBeNull();
      expect(preserved?.access_token).toBe('active_token');
    });
  });

  describe('In-Memory Rate Limiting Engine', () => {
    it('tracks requests and enforces window rate limits without DB overhead', () => {
      const testKey = 'test_ip_192.168.1.1';
      resetRateLimit(testKey);

      // First 3 requests allowed (max: 3)
      expect(checkRateLimit(testKey, 3, 60).allowed).toBe(true);
      expect(checkRateLimit(testKey, 3, 60).allowed).toBe(true);
      expect(checkRateLimit(testKey, 3, 60).allowed).toBe(true);

      // 4th request blocked
      const blocked = checkRateLimit(testKey, 3, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetIn).toBeGreaterThan(0);

      // Reset works
      resetRateLimit(testKey);
      expect(checkRateLimit(testKey, 3, 60).allowed).toBe(true);
    });
  });
});
