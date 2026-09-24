import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import {
  registerUser,
  loginWithPassword,
  changePassword,
  isValidUsername,
  enableTotp,
  resetPasswordWithTotp,
} from '../src/services/auth.service';
import {
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  createSession,
} from '../src/services/session.service';
import { generateTotpSecret, generateTotp } from '../src/crypto/totp';
import { execute } from '../src/db/client';

describe('Auth Service and Session Service Tests', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  describe('Username format validation', () => {
    it('validates common valid and invalid usernames', () => {
      expect(isValidUsername('alice')).toBe(true);
      expect(isValidUsername('bob_123')).toBe(true);
      expect(isValidUsername('user-name-99')).toBe(true);
      expect(isValidUsername('ab')).toBe(false); // too short
      expect(isValidUsername('a'.repeat(33))).toBe(false); // too long
      expect(isValidUsername('user with spaces')).toBe(false);
      expect(isValidUsername('user@domain.com')).toBe(false); // email disallowed
    });
  });

  describe('User Registration', () => {
    it('registers user, hashes password, and activates account immediately', async () => {
      const { user } = await registerUser(
        db,
        'NewUser',
        'ValidPassword123!'
      );

      expect(user.id).toBeDefined();
      expect(user.username).toBe('NewUser');
      expect(user.is_active).toBe(1);
      expect(user.totp_enabled).toBe(0);
      expect(user.password_hash.length).toBe(64);
    });

    it('rejects duplicate username registration', async () => {
      await registerUser(db, 'duplicate_user', 'Password123!');
      await expect(
        registerUser(db, 'duplicate_user', 'AnotherPassword123!')
      ).rejects.toThrow('Username is already taken');
    });

    it('rejects password shorter than 8 characters', async () => {
      await expect(
        registerUser(db, 'short_pass_user', 'short')
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('rejects invalid username format', async () => {
      await expect(
        registerUser(db, 'invalid@username', 'Password123!')
      ).rejects.toThrow('Username must be 3-32 characters long');
    });
  });

  describe('Password Login & Session Lifecycle', () => {
    it('authenticates user and returns active session', async () => {
      await registerUser(db, 'login_user', 'SecurePassword123!');

      const { user, session } = await loginWithPassword(
        db,
        'LOGIN_USER',
        'SecurePassword123!',
        'Mozilla/5.0'
      );

      expect(user.username).toBe('login_user');
      expect(session!.id.startsWith('sess_')).toBe(true);
      expect(session!.user_agent).toBe('Mozilla/5.0');

      const validated = await validateSession(db, session!.id);
      expect(validated).not.toBeNull();
      expect(validated?.user.id).toBe(user.id);
    });

    it('fails login with wrong password', async () => {
      await registerUser(db, 'login_fail', 'SecurePassword123!');

      await expect(
        loginWithPassword(db, 'login_fail', 'WrongPassword!')
      ).rejects.toThrow('Invalid username or password');
    });

    it('fails login with non-existent username', async () => {
      await expect(
        loginWithPassword(db, 'nonexistent_user', 'Password123!')
      ).rejects.toThrow('Invalid username or password');
    });

    it('fails login when account is deactivated', async () => {
      const { user } = await registerUser(db, 'inactive_user', 'Password123!');
      await execute(db, 'UPDATE users SET is_active = 0 WHERE id = ?', user.id);

      await expect(
        loginWithPassword(db, 'inactive_user', 'Password123!')
      ).rejects.toThrow('Account has been deactivated');
    });

    it('invalidates expired session during validation', async () => {
      const { user } = await registerUser(db, 'exp_sess_user', 'Password123!');
      const session = await createSession(db, user.id, null, -10); // already expired

      const validated = await validateSession(db, session.id);
      expect(validated).toBeNull();
    });

    it('revokes single session and multiple sessions', async () => {
      const { user } = await registerUser(db, 'sess_test_user', 'Password123!');
      const s1 = await createSession(db, user.id);
      const s2 = await createSession(db, user.id);

      expect(await validateSession(db, s1.id)).not.toBeNull();
      expect(await validateSession(db, s2.id)).not.toBeNull();

      // Revoke s1 only
      await revokeSession(db, s1.id);
      expect(await validateSession(db, s1.id)).toBeNull();
      expect(await validateSession(db, s2.id)).not.toBeNull();

      // Revoke all for user
      await revokeAllUserSessions(db, user.id);
      expect(await validateSession(db, s2.id)).toBeNull();
    });
  });

  describe('Password Reset with TOTP Flow', () => {
    it('resets password using valid TOTP code and invalidates sessions/tokens', async () => {
      const { user } = await registerUser(db, 'reset_user', 'OldPassword123!');
      const initialSession = await createSession(db, user.id);

      // Enable TOTP
      const secret = generateTotpSecret(20);
      const code = await generateTotp(secret);
      await enableTotp(db, user.id, secret, code);

      // Seed an active OAuth client and token for this user
      await execute(
        db,
        `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
         VALUES ('client_reset_test', 'secret', 'Reset App', '["https://example.com"]', '["openid"]', 0, 1000, 1000)`
      );
      await execute(
        db,
        `INSERT INTO oauth_tokens (id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at)
         VALUES ('tok_reset_test', 'client_reset_test', ?, 'at_reset_test', 'rt_reset_test', 'openid', 9999999999, 0, 1000)`,
        user.id
      );

      const resetCode = await generateTotp(secret);
      const updatedUser = await resetPasswordWithTotp(
        db,
        'reset_user',
        resetCode,
        'BrandNewPassword456!'
      );
      expect(updatedUser.id).toBe(user.id);

      // Old password should now fail
      await expect(
        loginWithPassword(db, 'reset_user', 'OldPassword123!')
      ).rejects.toThrow('Invalid username or password');

      // Old session was revoked
      const oldSessCheck = await validateSession(db, initialSession.id);
      expect(oldSessCheck).toBeNull();

      // OAuth token was revoked
      const tokenRow = await db.prepare('SELECT revoked FROM oauth_tokens WHERE id = ?')
        .bind('tok_reset_test')
        .first<{ revoked: number }>();
      expect(tokenRow?.revoked).toBe(1);
    });

    it('rejects reset for user who has not enabled TOTP', async () => {
      await registerUser(db, 'no_totp_reset', 'OldPassword123!');
      await expect(
        resetPasswordWithTotp(db, 'no_totp_reset', '123456', 'NewPassword123!')
      ).rejects.toThrow('This account does not have Google Authenticator enabled');
    });
  });

  describe('Password Change Flow', () => {
    it('changes password when old password matches and invalidates old sessions and oauth tokens', async () => {
      const { user } = await registerUser(db, 'change_user', 'CurrentPassword123!');
      const session = await createSession(db, user.id);

      // Seed an active OAuth client and token for this user
      await execute(
        db,
        `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
         VALUES ('client_change_test', 'secret', 'Change App', '["https://example.com"]', '["openid"]', 0, 1000, 1000)`
      );
      await execute(
        db,
        `INSERT INTO oauth_tokens (id, client_id, user_id, access_token, refresh_token, scope, expires_at, revoked, created_at)
         VALUES ('tok_change_test', 'client_change_test', ?, 'at_change_test', 'rt_change_test', 'openid', 9999999999, 0, 1000)`,
        user.id
      );

      await changePassword(db, user.id, 'CurrentPassword123!', 'NewPassword789!');

      // Old password fails
      await expect(
        loginWithPassword(db, 'change_user', 'CurrentPassword123!')
      ).rejects.toThrow('Invalid username or password');

      // New password succeeds
      await expect(
        loginWithPassword(db, 'change_user', 'NewPassword789!')
      ).resolves.toBeDefined();

      // Old session revoked
      expect(await validateSession(db, session.id)).toBeNull();

      // OAuth token was revoked
      const tokenRow = await db.prepare('SELECT revoked FROM oauth_tokens WHERE id = ?')
        .bind('tok_change_test')
        .first<{ revoked: number }>();
      expect(tokenRow?.revoked).toBe(1);
    });

    it('rejects password change if current password is wrong', async () => {
      const { user } = await registerUser(db, 'change_user_wrong', 'CurrentPassword123!');

      await expect(
        changePassword(db, user.id, 'WrongCurrentPassword', 'NewPassword789!')
      ).rejects.toThrow('Current password is incorrect');
    });
  });
});
