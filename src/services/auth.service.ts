import { queryFirst, execute } from '../db/client';
import type { User, VerificationToken } from '../db/schema';
import { hashPassword, verifyPassword } from '../crypto/password';
import { generateId, generateRandomToken } from '../crypto/token';
import { createSession, revokeAllUserSessions } from './session.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
const VERIFY_EMAIL_DURATION_SECONDS = 24 * 3600; // 24 hours
const RESET_PASSWORD_DURATION_SECONDS = 3600; // 1 hour

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

/**
 * Registers a new user and generates an email verification token.
 */
export async function registerUser(
  db: D1Database,
  email: string,
  password: string,
  options?: { isAdmin?: boolean }
): Promise<{ user: User; verificationToken: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Invalid email address format');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  const existing = await queryFirst<User>(
    db,
    'SELECT id FROM users WHERE email = ?',
    normalizedEmail
  );
  if (existing) {
    throw new Error('Email is already registered');
  }

  const userId = generateId('usr');
  const now = Math.floor(Date.now() / 1000);
  const { hash, salt } = await hashPassword(password);
  const isAdmin = options?.isAdmin ? 1 : 0;

  await execute(
    db,
    `INSERT INTO users (id, email, password_hash, password_salt, email_verified, is_active, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?)`,
    userId,
    normalizedEmail,
    hash,
    salt,
    isAdmin,
    now,
    now
  );

  const verificationToken = await createVerificationToken(
    db,
    userId,
    'verify_email',
    VERIFY_EMAIL_DURATION_SECONDS
  );

  const user: User = {
    id: userId,
    email: normalizedEmail,
    password_hash: hash,
    password_salt: salt,
    email_verified: 0,
    is_active: 1,
    is_admin: isAdmin,
    created_at: now,
    updated_at: now,
  };

  return { user, verificationToken };
}

/**
 * Authenticates a user with email and password and creates a session.
 */
export async function loginWithPassword(
  db: D1Database,
  email: string,
  password: string,
  userAgent: string | null = null
): Promise<{ user: User; session: Awaited<ReturnType<typeof createSession>> }> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE email = ?',
    normalizedEmail
  );

  if (!user) {
    throw new Error('Invalid email or password');
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
    throw new Error('Invalid email or password');
  }

  const session = await createSession(db, user.id, userAgent);
  return { user, session };
}

/**
 * Creates a verification or password reset token.
 */
export async function createVerificationToken(
  db: D1Database,
  userId: string,
  type: 'verify_email' | 'reset_password',
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
 * Verifies an email verification token and marks user's email as verified.
 */
export async function verifyEmailToken(
  db: D1Database,
  token: string
): Promise<User> {
  const now = Math.floor(Date.now() / 1000);

  const tokenRecord = await queryFirst<VerificationToken>(
    db,
    'SELECT * FROM verification_tokens WHERE token = ? AND type = ?',
    token,
    'verify_email'
  );

  if (!tokenRecord || tokenRecord.used === 1) {
    throw new Error('Invalid or already used verification link');
  }

  if (tokenRecord.expires_at <= now) {
    throw new Error('Verification link has expired');
  }

  await execute(
    db,
    'UPDATE verification_tokens SET used = 1 WHERE token = ?',
    token
  );

  await execute(
    db,
    'UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?',
    now,
    tokenRecord.user_id
  );

  const updatedUser = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE id = ?',
    tokenRecord.user_id
  );

  if (!updatedUser) {
    throw new Error('User not found');
  }

  return updatedUser;
}

/**
 * Creates a password reset token for an email address.
 */
export async function createPasswordResetToken(
  db: D1Database,
  email: string
): Promise<{ token: string; user: User } | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE email = ?',
    normalizedEmail
  );

  if (!user || user.is_active !== 1) {
    return null;
  }

  const token = await createVerificationToken(
    db,
    user.id,
    'reset_password',
    RESET_PASSWORD_DURATION_SECONDS
  );

  return { token, user };
}

/**
 * Resets a user's password using a valid reset token.
 */
export async function resetPasswordWithToken(
  db: D1Database,
  token: string,
  newPassword: string
): Promise<User> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  const now = Math.floor(Date.now() / 1000);

  const tokenRecord = await queryFirst<VerificationToken>(
    db,
    'SELECT * FROM verification_tokens WHERE token = ? AND type = ?',
    token,
    'reset_password'
  );

  if (!tokenRecord || tokenRecord.used === 1) {
    throw new Error('Invalid or already used password reset link');
  }

  if (tokenRecord.expires_at <= now) {
    throw new Error('Password reset link has expired');
  }

  const { hash, salt } = await hashPassword(newPassword);

  await execute(
    db,
    'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?',
    hash,
    salt,
    now,
    tokenRecord.user_id
  );

  await execute(
    db,
    'UPDATE verification_tokens SET used = 1 WHERE token = ?',
    token
  );

  // Revoke all existing sessions and active OAuth tokens for security
  await revokeAllUserSessions(db, tokenRecord.user_id);
  await execute(
    db,
    'UPDATE oauth_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0',
    tokenRecord.user_id
  );

  const updatedUser = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE id = ?',
    tokenRecord.user_id
  );

  if (!updatedUser) {
    throw new Error('User not found');
  }

  return updatedUser;
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
