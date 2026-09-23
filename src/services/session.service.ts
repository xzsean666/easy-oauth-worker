import { queryFirst, execute } from '../db/client';
import type { Session, User } from '../db/schema';
import { generateId } from '../crypto/token';

export const DEFAULT_SESSION_DURATION_SECONDS = 7 * 24 * 3600; // 7 days

/**
 * Creates a new session in the database.
 */
export async function createSession(
  db: D1Database,
  userId: string,
  userAgent: string | null = null,
  durationSeconds: number = DEFAULT_SESSION_DURATION_SECONDS
): Promise<Session> {
  const sessionId = generateId('sess');
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + durationSeconds;

  await execute(
    db,
    `INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    sessionId,
    userId,
    expiresAt,
    now,
    userAgent
  );

  return {
    id: sessionId,
    user_id: userId,
    expires_at: expiresAt,
    created_at: now,
    user_agent: userAgent,
  };
}

/**
 * Validates a session by ID, returning session info and active user if valid.
 */
export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<{ session: Session; user: User } | null> {
  const now = Math.floor(Date.now() / 1000);

  const session = await queryFirst<Session>(
    db,
    'SELECT * FROM sessions WHERE id = ?',
    sessionId
  );

  if (!session) {
    return null;
  }

  if (session.expires_at <= now) {
    // Clean up expired session asynchronously
    await execute(db, 'DELETE FROM sessions WHERE id = ?', sessionId);
    return null;
  }

  const user = await queryFirst<User>(
    db,
    'SELECT * FROM users WHERE id = ?',
    session.user_id
  );

  if (!user || user.is_active !== 1) {
    return null;
  }

  return { session, user };
}

/**
 * Revokes a single session by ID.
 */
export async function revokeSession(
  db: D1Database,
  sessionId: string
): Promise<boolean> {
  const res = await execute(db, 'DELETE FROM sessions WHERE id = ?', sessionId);
  return (res.meta.changes ?? 0) > 0;
}

/**
 * Revokes all sessions for a specific user.
 */
export async function revokeAllUserSessions(
  db: D1Database,
  userId: string
): Promise<boolean> {
  const res = await execute(db, 'DELETE FROM sessions WHERE user_id = ?', userId);
  return (res.meta.changes ?? 0) > 0;
}
