import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import {
  registerUser,
  loginWithPassword,
  verifyEmailToken,
  createPasswordResetToken,
  resetPasswordWithToken,
  changePassword,
  isValidEmail,
} from '../src/services/auth.service';
import {
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  createSession,
} from '../src/services/session.service';
import { execute } from '../src/db/client';

describe('Auth Service and Session Service Tests', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  describe('Email format validation', () => {
    it('validates common valid and invalid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@sub.domain.org')).toBe(true);
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missinguser.com')).toBe(false);
      expect(isValidEmail('missingdomain@.com')).toBe(false);
    });
  });

  describe('User Registration', () => {
    it('registers user, hashes password, and creates verification token', async () => {
      const { user, verificationToken } = await registerUser(
        db,
        'NewUser@Example.COM',
        'ValidPassword123!'
      );

      expect(user.id).toBeDefined();
      expect(user.email).toBe('newuser@example.com'); // normalized lowercase
      expect(user.email_verified).toBe(0);
      expect(user.is_active).toBe(1);
      expect(user.password_hash.length).toBe(64);
      expect(verificationToken).toBeDefined();
    });

    it('rejects duplicate email registration', async () => {
      await registerUser(db, 'duplicate@example.com', 'Password123!');
      await expect(
        registerUser(db, 'duplicate@example.com', 'AnotherPassword123!')
      ).rejects.toThrow('Email is already registered');
    });

    it('rejects password shorter than 8 characters', async () => {
      await expect(
        registerUser(db, 'short@example.com', 'short')
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('rejects invalid email address', async () => {
      await expect(
        registerUser(db, 'invalid-email', 'Password123!')
      ).rejects.toThrow('Invalid email address format');
    });
  });

  describe('Email Verification', () => {
    it('verifies email using valid token', async () => {
      const { user, verificationToken } = await registerUser(
        db,
        'verify@example.com',
        'Password123!'
      );
      expect(user.email_verified).toBe(0);

      const verifiedUser = await verifyEmailToken(db, verificationToken);
      expect(verifiedUser.email_verified).toBe(1);
    });

    it('rejects already used verification token', async () => {
      const { verificationToken } = await registerUser(
        db,
        'verify2@example.com',
        'Password123!'
      );

      await verifyEmailToken(db, verificationToken);

      await expect(verifyEmailToken(db, verificationToken)).rejects.toThrow(
        'Invalid or already used verification link'
      );
    });

    it('rejects expired verification token', async () => {
      const { verificationToken } = await registerUser(
        db,
        'expired@example.com',
        'Password123!'
      );

      // Force expire token in DB
      await execute(
        db,
        'UPDATE verification_tokens SET expires_at = ? WHERE token = ?',
        Math.floor(Date.now() / 1000) - 100,
        verificationToken
      );

      await expect(verifyEmailToken(db, verificationToken)).rejects.toThrow(
        'Verification link has expired'
      );
    });
  });

  describe('Password Login & Session Lifecycle', () => {
    it('authenticates user and returns active session', async () => {
      await registerUser(db, 'login@example.com', 'SecurePassword123!');

      const { user, session } = await loginWithPassword(
        db,
        'LOGIN@EXAMPLE.COM',
        'SecurePassword123!',
        'Mozilla/5.0'
      );

      expect(user.email).toBe('login@example.com');
      expect(session.id.startsWith('sess_')).toBe(true);
      expect(session.user_agent).toBe('Mozilla/5.0');

      const validated = await validateSession(db, session.id);
      expect(validated).not.toBeNull();
      expect(validated?.user.id).toBe(user.id);
    });

    it('fails login with wrong password', async () => {
      await registerUser(db, 'login2@example.com', 'SecurePassword123!');

      await expect(
        loginWithPassword(db, 'login2@example.com', 'WrongPassword!')
      ).rejects.toThrow('Invalid email or password');
    });

    it('fails login with non-existent email', async () => {
      await expect(
        loginWithPassword(db, 'nonexistent@example.com', 'Password123!')
      ).rejects.toThrow('Invalid email or password');
    });

    it('fails login when account is deactivated', async () => {
      const { user } = await registerUser(db, 'inactive@example.com', 'Password123!');
      await execute(db, 'UPDATE users SET is_active = 0 WHERE id = ?', user.id);

      await expect(
        loginWithPassword(db, 'inactive@example.com', 'Password123!')
      ).rejects.toThrow('Account has been deactivated');
    });

    it('invalidates expired session during validation', async () => {
      const { user } = await registerUser(db, 'exp_sess@example.com', 'Password123!');
      const session = await createSession(db, user.id, null, -10); // already expired

      const validated = await validateSession(db, session.id);
      expect(validated).toBeNull();
    });

    it('revokes single session and multiple sessions', async () => {
      const { user } = await registerUser(db, 'sess_test@example.com', 'Password123!');
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

  describe('Password Reset Flow', () => {
    it('creates password reset token and resets password', async () => {
      const { user } = await registerUser(db, 'reset@example.com', 'OldPassword123!');
      const initialSession = await createSession(db, user.id);

      const resetData = await createPasswordResetToken(db, 'reset@example.com');
      expect(resetData).not.toBeNull();
      expect(resetData?.token).toBeDefined();

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

      const updatedUser = await resetPasswordWithToken(
        db,
        resetData!.token,
        'BrandNewPassword456!'
      );
      expect(updatedUser.id).toBe(user.id);

      // Old password should now fail
      await expect(
        loginWithPassword(db, 'reset@example.com', 'OldPassword123!')
      ).rejects.toThrow('Invalid email or password');

      // New password should succeed
      const { session: newSession } = await loginWithPassword(
        db,
        'reset@example.com',
        'BrandNewPassword456!'
      );
      expect(newSession).toBeDefined();

      // Old session was revoked
      const oldSessCheck = await validateSession(db, initialSession.id);
      expect(oldSessCheck).toBeNull();

      // OAuth token was revoked
      const tokenRow = await db.prepare('SELECT revoked FROM oauth_tokens WHERE id = ?')
        .bind('tok_reset_test')
        .first<{ revoked: number }>();
      expect(tokenRow?.revoked).toBe(1);
    });

    it('returns null when requesting reset for non-existent email', async () => {
      const res = await createPasswordResetToken(db, 'nobody@example.com');
      expect(res).toBeNull();
    });
  });

  describe('Password Change Flow', () => {
    it('changes password when old password matches and invalidates old sessions and oauth tokens', async () => {
      const { user } = await registerUser(db, 'change@example.com', 'CurrentPassword123!');
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
        loginWithPassword(db, 'change@example.com', 'CurrentPassword123!')
      ).rejects.toThrow('Invalid email or password');

      // New password succeeds
      await expect(
        loginWithPassword(db, 'change@example.com', 'NewPassword789!')
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
      const { user } = await registerUser(db, 'change2@example.com', 'CurrentPassword123!');

      await expect(
        changePassword(db, user.id, 'WrongCurrentPassword', 'NewPassword789!')
      ).rejects.toThrow('Current password is incorrect');
    });
  });
});
