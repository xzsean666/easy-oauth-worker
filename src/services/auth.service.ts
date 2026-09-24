import { queryFirst, execute } from '../db/client';
import type { User, VerificationTokenType } from '../db/schema';
import { hashPassword, verifyPassword } from '../crypto/password';
import { generateId, generateRandomToken } from '../crypto/token';
import { verifyTotp } from '../crypto/totp';
import { createSession, revokeAllUserSessions } from './session.service';

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username.trim());
}

export interface RegisterOptions {
  isAdmin?: boolean;
}

/**
 * Registers a new user with a unique username and password.
 */
export async function registerUser(
  db: D1Database,
  username: string,
  password: string,
  options?: RegisterOptions
): Promise<{ user: User }> {
  const trimmedUsername = username.trim();

  if (!isValidUsername(trimmedUsername)) {
    throw new Error('Username must be 3-32 characters long and contain only letters, numbers, underscores, or hyphens');
  }

  // Check username uniqueness (case-insensitive)
  const existingUsername = await queryFirst<User>(
    db,
    'SELECT id FROM users WHERE LOWER(username) = ?',
    trimmedUsername.toLowerCase()
  );
  if (existingUsername) {
    throw new Error('Username is already taken');
  }

  // Password validation
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  const userId = generateId('usr');
  const now = Math.floor(Date.now() / 1000);
  const { hash, salt } = await hashPassword(password);
  const isAdmin = options?.isAdmin ? 1 : 0;

  await execute(
    db,
    `INSERT INTO users (id, username, password_hash, password_salt, is_active, is_admin, totp_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, 0, ?, ?)`,
    userId,
    trimmedUsername,
    hash,
    salt,
    isAdmin,
    now,
    now
  );

  const user: User = {
    id: userId,
    username: trimmedUsername,
    password_hash: hash,
    password_salt: salt,
    is_active: 1,
    is_admin: isAdmin,
    totp_enabled: 0,
    created_at: now,
    updated_at: now,
  };

  return { user };
}

export interface LoginResult {
  user: User;
  session?: Awaited<ReturnType<typeof createSession>> | null;
  requires2fa: boolean;
}

/**
 * Authenticates a user with username and password.
 * If user has TOTP 2FA enabled, requires2fa will be true and session will be null.
 */
export async function loginWithPassword(
  db: D1Database,
  username: string,
  password: string,
  userAgent: string | null = null
): Promise<LoginResult> {
  const trimmed = username.trim().toLowerCase();

  const user = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE LOWER(username) = ?',
    trimmed
  );

  if (!user) {
    throw new Error('Invalid username or password');
  }

  if (user.is_active !== 1) {
    throw new Error('Account has been deactivated');
  }

  const isPasswordValid = await verifyPassword(
    password,
    user.password_hash,
    user.password_salt
  );

  if (!isPasswordValid) {
    throw new Error('Invalid username or password');
  }

  if (user.totp_enabled === 1 && user.totp_secret) {
    // 2FA required
    return { user, session: null, requires2fa: true };
  }

  const session = await createSession(db, user.id, userAgent);
  return { user, session, requires2fa: false };
}

/**
 * Verifies a 6-digit TOTP code during 2FA login and creates a full session.
 */
export async function verifyLogin2fa(
  db: D1Database,
  userId: string,
  totpCode: string,
  userAgent: string | null = null
): Promise<{ user: User; session: Awaited<ReturnType<typeof createSession>> }> {
  const user = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE id = ?',
    userId
  );

  if (!user || user.is_active !== 1) {
    throw new Error('User not found or deactivated');
  }

  if (user.totp_enabled !== 1 || !user.totp_secret) {
    throw new Error('Two-factor authentication is not enabled for this user');
  }

  const valid = await verifyTotp(user.totp_secret, totpCode);
  if (!valid) {
    throw new Error('Invalid or expired authentication code');
  }

  const session = await createSession(db, user.id, userAgent);
  return { user, session };
}

/**
 * Activates TOTP two-factor authentication for a user after confirming with a valid code.
 */
export async function enableTotp(
  db: D1Database,
  userId: string,
  secret: string,
  code: string
): Promise<User> {
  const valid = await verifyTotp(secret, code);
  if (!valid) {
    throw new Error('Invalid verification code. Make sure the code in your authenticator app matches.');
  }

  const now = Math.floor(Date.now() / 1000);
  await execute(
    db,
    'UPDATE users SET totp_secret = ?, totp_enabled = 1, updated_at = ? WHERE id = ?',
    secret,
    now,
    userId
  );

  const updated = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', userId);
  return updated!;
}

/**
 * Disables TOTP two-factor authentication for a user after verifying current password.
 */
export async function disableTotp(
  db: D1Database,
  userId: string,
  currentPassword: string
): Promise<User> {
  const user = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', userId);
  if (!user) {
    throw new Error('User not found');
  }

  const isPasswordValid = await verifyPassword(
    currentPassword,
    user.password_hash,
    user.password_salt
  );
  if (!isPasswordValid) {
    throw new Error('Incorrect current password. Two-factor authentication remains active.');
  }

  const now = Math.floor(Date.now() / 1000);
  await execute(
    db,
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0, updated_at = ? WHERE id = ?',
    now,
    userId
  );

  const updated = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', userId);
  return updated!;
}

/**
 * Resets a user's password using their Google Authenticator (TOTP) code.
 * Explicitly rejects if the account does not have TOTP enabled.
 */
export async function resetPasswordWithTotp(
  db: D1Database,
  username: string,
  totpCode: string,
  newPassword: string
): Promise<User> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  const trimmed = username.trim().toLowerCase();
  const user = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE LOWER(username) = ?',
    trimmed
  );

  if (!user || user.is_active !== 1) {
    throw new Error('Invalid recovery credentials');
  }

  // Explicit policy requirement: without TOTP, user CANNOT recover password self-service
  if (user.totp_enabled !== 1 || !user.totp_secret) {
    throw new Error(
      'This account does not have Google Authenticator enabled. Password cannot be recovered self-service. Please contact the administrator for assistance.'
    );
  }

  const valid = await verifyTotp(user.totp_secret, totpCode);
  if (!valid) {
    throw new Error('Invalid or expired Google Authenticator code');
  }

  const now = Math.floor(Date.now() / 1000);
  const { hash, salt } = await hashPassword(newPassword);

  await execute(
    db,
    'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?',
    hash,
    salt,
    now,
    user.id
  );

  // Revoke all active sessions and OAuth tokens for security
  await revokeAllUserSessions(db, user.id);
  await execute(
    db,
    'UPDATE oauth_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0',
    user.id
  );

  const updated = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', user.id);
  return updated!;
}

/**
 * Creates a verification token (e.g. for login_2fa ticket).
 */
export async function createVerificationToken(
  db: D1Database,
  userId: string,
  type: VerificationTokenType,
  durationSeconds: number
): Promise<string> {
  const token = generateRandomToken(32);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + durationSeconds;

  await execute(
    db,
    `INSERT INTO verification_tokens (token, user_id, type, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    token,
    userId,
    type,
    expiresAt,
    now
  );

  return token;
}

/**
 * Changes a user's password given their current password.
 */
export async function changePassword(
  db: D1Database,
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<User> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  const user = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE id = ?',
    userId
  );

  if (!user) {
    throw new Error('User not found');
  }

  const isOldPasswordCorrect = await verifyPassword(
    oldPassword,
    user.password_hash,
    user.password_salt
  );

  if (!isOldPasswordCorrect) {
    throw new Error('Current password is incorrect');
  }

  const now = Math.floor(Date.now() / 1000);
  const { hash, salt } = await hashPassword(newPassword);

  await execute(
    db,
    'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?',
    hash,
    salt,
    now,
    userId
  );

  // Revoke all sessions and active OAuth tokens on password change
  await revokeAllUserSessions(db, userId);
  await execute(
    db,
    'UPDATE oauth_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0',
    userId
  );

  const updatedUser = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE id = ?',
    userId
  );

  return updatedUser!;
}
