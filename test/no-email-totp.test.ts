import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import {
  registerUser,
  loginWithPassword,
  verifyLogin2fa,
  enableTotp,
  disableTotp,
  resetPasswordWithTotp,
} from '../src/services/auth.service';
import { generateTotpSecret, generateTotp, generateTotpUri } from '../src/crypto/totp';
import { validateSession } from '../src/services/session.service';

describe('No-Email & Google Authenticator (TOTP) 2FA and Recovery Tests', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  describe('Pure Username (No-Email) Registration & Login', () => {
    it('registers user with username only, activates account immediately without email verification', async () => {
      const { user } = await registerUser(
        db,
        'crypto_bob',
        'SecurePassword123!'
      );

      expect(user.id).toBeDefined();
      expect(user.username).toBe('crypto_bob');
      expect(user.is_active).toBe(1);
      expect(user.totp_enabled).toBe(0);
    });

    it('allows logging in with username directly', async () => {
      await registerUser(db, 'alice_geek', 'AlicePass123!');

      const loginRes = await loginWithPassword(db, 'alice_geek', 'AlicePass123!');
      expect(loginRes.requires2fa).toBe(false);
      expect(loginRes.session).toBeDefined();
      expect(loginRes.user.username).toBe('alice_geek');

      const sessionData = await validateSession(db, loginRes.session!.id);
      expect(sessionData).not.toBeNull();
      expect(sessionData?.user.username).toBe('alice_geek');
    });

    it('rejects duplicate username registration', async () => {
      await registerUser(db, 'charlie', 'Pass123456!');
      await expect(
        registerUser(db, 'charlie', 'Pass123456!')
      ).rejects.toThrow('Username is already taken');
    });

    it('rejects invalid username characters or length', async () => {
      await expect(
        registerUser(db, 'ab', 'Pass123456!')
      ).rejects.toThrow('Username must be 3-32 characters long');

      await expect(
        registerUser(db, 'bad user name!', 'Pass123456!')
      ).rejects.toThrow('Username must be 3-32 characters long');
    });
  });

  describe('TOTP (Google Authenticator) 2FA Switch & Lifecycle', () => {
    it('allows user to enable TOTP by confirming with a valid dynamic code', async () => {
      const { user } = await registerUser(db, 'david_sec', 'DavidPass123!');

      const secret = generateTotpSecret(20);
      const uri = generateTotpUri('david_sec', secret, 'EasyOAuth');
      expect(uri).toContain('otpauth://totp/');

      // Generate valid code
      const validCode = await generateTotp(secret);
      const updatedUser = await enableTotp(db, user.id, secret, validCode);

      expect(updatedUser.totp_enabled).toBe(1);
      expect(updatedUser.totp_secret).toBe(secret);
    });

    it('rejects enabling TOTP with invalid code', async () => {
      const { user } = await registerUser(db, 'eva_test', 'EvaPassword123!');
      const secret = generateTotpSecret(20);

      await expect(
        enableTotp(db, user.id, secret, '000000')
      ).rejects.toThrow('Invalid verification code');
    });

    it('requires 2FA code during login once TOTP is enabled', async () => {
      const { user } = await registerUser(db, 'frank_2fa', 'FrankPass123!');
      const secret = generateTotpSecret(20);
      const validCode = await generateTotp(secret);
      await enableTotp(db, user.id, secret, validCode);

      // Attempt initial login
      const loginAttempt = await loginWithPassword(db, 'frank_2fa', 'FrankPass123!');
      expect(loginAttempt.requires2fa).toBe(true);
      expect(loginAttempt.session).toBeNull();

      // Submit wrong 2FA code
      await expect(
        verifyLogin2fa(db, user.id, '999999')
      ).rejects.toThrow('Invalid or expired authentication code');

      // Submit correct 2FA code
      const currentCode = await generateTotp(secret);
      const { session } = await verifyLogin2fa(db, user.id, currentCode);
      expect(session).toBeDefined();

      const validSession = await validateSession(db, session.id);
      expect(validSession).not.toBeNull();
    });

    it('allows user to disable TOTP after verifying current password', async () => {
      const { user } = await registerUser(db, 'grace_opt', 'GracePassword123!');
      const secret = generateTotpSecret(20);
      await enableTotp(db, user.id, secret, await generateTotp(secret));

      // Attempt to disable with wrong password
      await expect(
        disableTotp(db, user.id, 'WrongPassword!')
      ).rejects.toThrow('Incorrect current password');

      // Disable with correct password
      const disabledUser = await disableTotp(db, user.id, 'GracePassword123!');
      expect(disabledUser.totp_enabled).toBe(0);
      expect(disabledUser.totp_secret).toBeNull();

      // Next login does not require 2FA anymore
      const nextLogin = await loginWithPassword(db, 'grace_opt', 'GracePassword123!');
      expect(nextLogin.requires2fa).toBe(false);
      expect(nextLogin.session).toBeDefined();
    });
  });

  describe('Password Recovery without Email via Google Authenticator (TOTP)', () => {
    it('EXPLICIT POLICY: rejects password recovery if user has NOT enabled TOTP', async () => {
      await registerUser(db, 'no_totp_user', 'OldPassword123!');

      // Attempt recovery without having enabled TOTP
      await expect(
        resetPasswordWithTotp(db, 'no_totp_user', '123456', 'BrandNewPassword123!')
      ).rejects.toThrow(
        'This account does not have Google Authenticator enabled. Password cannot be recovered self-service. Please contact the administrator for assistance.'
      );
    });

    it('allows password recovery with valid TOTP code and invalidates prior sessions', async () => {
      const { user } = await registerUser(db, 'totp_recover_user', 'OldPassword123!');
      const secret = generateTotpSecret(20);
      await enableTotp(db, user.id, secret, await generateTotp(secret));

      // Create an active session
      const { session } = await verifyLogin2fa(db, user.id, await generateTotp(secret));
      expect(await validateSession(db, session.id)).not.toBeNull();

      // Wrong TOTP code fails
      await expect(
        resetPasswordWithTotp(db, 'totp_recover_user', '000000', 'NewStrongPassword123!')
      ).rejects.toThrow('Invalid or expired Google Authenticator code');

      // Valid TOTP code resets password
      const resetCode = await generateTotp(secret);
      const updatedUser = await resetPasswordWithTotp(
        db,
        'totp_recover_user',
        resetCode,
        'NewStrongPassword123!'
      );
      expect(updatedUser.id).toBe(user.id);

      // Old session was revoked
      expect(await validateSession(db, session.id)).toBeNull();

      // Old password fails to login
      await expect(
        loginWithPassword(db, 'totp_recover_user', 'OldPassword123!')
      ).rejects.toThrow('Invalid username or password');

      // New password works (requires 2FA as TOTP remains active)
      const newLogin = await loginWithPassword(db, 'totp_recover_user', 'NewStrongPassword123!');
      expect(newLogin.requires2fa).toBe(true);
    });
  });
});
