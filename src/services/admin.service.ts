import { queryFirst, queryAll, execute } from '../db/client';
import type { User, OAuthClient } from '../db/schema';
import { generateId, generateRandomToken } from '../crypto/token';
import { revokeAllUserSessions } from './session.service';

export interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  activeSessions: number;
  totalClients: number;
}

export type SafeUser = Omit<User, 'password_hash' | 'password_salt'>;

/**
 * Aggregates dashboard metrics from the database.
 */
export async function getDashboardStats(db: D1Database): Promise<DashboardStats> {
  const now = Math.floor(Date.now() / 1000);

  const totalUsersRow = await queryFirst<{ count: number }>(
    db,
    'SELECT COUNT(*) as count FROM users'
  );

  const verifiedUsersRow = await queryFirst<{ count: number }>(
    db,
    'SELECT COUNT(*) as count FROM users WHERE email_verified = 1'
  );

  const activeSessionsRow = await queryFirst<{ count: number }>(
    db,
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?',
    now
  );

  const totalClientsRow = await queryFirst<{ count: number }>(
    db,
    'SELECT COUNT(*) as count FROM oauth_clients'
  );

  return {
    totalUsers: totalUsersRow?.count ?? 0,
    verifiedUsers: verifiedUsersRow?.count ?? 0,
    activeSessions: activeSessionsRow?.count ?? 0,
    totalClients: totalClientsRow?.count ?? 0,
  };
}

/**
 * Retrieves a paginated list of safe user objects with optional search filter.
 */
export async function listUsers(
  db: D1Database,
  options?: { limit?: number; offset?: number; search?: string }
): Promise<{ users: SafeUser[]; total: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const search = options?.search?.trim() ?? '';

  let countSql = 'SELECT COUNT(*) as count FROM users';
  let querySql = `
    SELECT id, email, email_verified, is_active, is_admin, created_at, updated_at
    FROM users
  `;
  const params: unknown[] = [];

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`;
    countSql += ' WHERE LOWER(email) LIKE ?';
    querySql += ' WHERE LOWER(email) LIKE ?';
    params.push(searchPattern);
  }

  querySql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const totalRow = await queryFirst<{ count: number }>(db, countSql, ...(search ? [params[0]] : []));
  const users = await queryAll<SafeUser>(db, querySql, ...params, limit, offset);

  return {
    users,
    total: totalRow?.count ?? 0,
  };
}

/**
 * Updates a user's flags (is_active, email_verified, is_admin).
 */
export async function updateUserStatus(
  db: D1Database,
  userId: string,
  updates: { is_active?: number; email_verified?: number; is_admin?: number }
): Promise<SafeUser> {
  const user = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', userId);
  if (!user) {
    throw new Error('User not found');
  }

  const newIsActive = updates.is_active !== undefined ? updates.is_active : user.is_active;
  const newEmailVerified = updates.email_verified !== undefined ? updates.email_verified : user.email_verified;
  const newIsAdmin = updates.is_admin !== undefined ? updates.is_admin : user.is_admin;
  const now = Math.floor(Date.now() / 1000);

  await execute(
    db,
    'UPDATE users SET is_active = ?, email_verified = ?, is_admin = ?, updated_at = ? WHERE id = ?',
    newIsActive,
    newEmailVerified,
    newIsAdmin,
    now,
    userId
  );

  // If user was deactivated, revoke all their active sessions immediately
  if (newIsActive === 0) {
    await revokeAllUserSessions(db, userId);
  }

  return {
    id: user.id,
    email: user.email,
    email_verified: newEmailVerified,
    is_active: newIsActive,
    is_admin: newIsAdmin,
    created_at: user.created_at,
    updated_at: now,
  };
}

/**
 * Deletes a user from the system.
 */
export async function deleteUser(
  db: D1Database,
  userId: string,
  currentAdminId?: string
): Promise<boolean> {
  if (currentAdminId && userId === currentAdminId) {
    throw new Error('You cannot delete your own administrator account');
  }

  const res = await execute(db, 'DELETE FROM users WHERE id = ?', userId);
  return (res.meta.changes ?? 0) > 0;
}

/**
 * Lists all registered OAuth clients.
 */
export async function listClients(db: D1Database): Promise<OAuthClient[]> {
  return queryAll<OAuthClient>(db, 'SELECT * FROM oauth_clients ORDER BY created_at DESC');
}

/**
 * Creates a new OAuth client.
 */
export async function createClient(
  db: D1Database,
  data: {
    name: string;
    redirectUris: string[];
    allowedScopes?: string[];
    isPublic?: boolean;
  }
): Promise<{ client: OAuthClient; plainSecret: string }> {
  if (!data.name.trim()) {
    throw new Error('Client name is required');
  }

  if (!data.redirectUris || data.redirectUris.length === 0) {
    throw new Error('At least one redirect URI is required');
  }

  const clientId = generateId('client');
  const clientSecret = generateRandomToken(32);
  const now = Math.floor(Date.now() / 1000);
  const scopes = data.allowedScopes && data.allowedScopes.length > 0 ? data.allowedScopes : ['openid', 'email', 'profile'];
  const isPublic = data.isPublic ? 1 : 0;

  await execute(
    db,
    `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    clientId,
    clientSecret,
    data.name.trim(),
    JSON.stringify(data.redirectUris),
    JSON.stringify(scopes),
    isPublic,
    now,
    now
  );

  const client: OAuthClient = {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: data.name.trim(),
    redirect_uris: JSON.stringify(data.redirectUris),
    allowed_scopes: JSON.stringify(scopes),
    is_public: isPublic,
    created_at: now,
    updated_at: now,
  };

  return { client, plainSecret: clientSecret };
}

/**
 * Rotates an existing OAuth client's secret.
 */
export async function rotateClientSecret(
  db: D1Database,
  clientId: string
): Promise<{ clientId: string; newSecret: string }> {
  const client = await queryFirst<OAuthClient>(
    db,
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    clientId
  );

  if (!client) {
    throw new Error('OAuth client not found');
  }

  const newSecret = generateRandomToken(32);
  const now = Math.floor(Date.now() / 1000);

  await execute(
    db,
    'UPDATE oauth_clients SET client_secret = ?, updated_at = ? WHERE client_id = ?',
    newSecret,
    now,
    clientId
  );

  return { clientId, newSecret };
}

/**
 * Deletes an OAuth client.
 */
export async function deleteClient(
  db: D1Database,
  clientId: string
): Promise<boolean> {
  const res = await execute(db, 'DELETE FROM oauth_clients WHERE client_id = ?', clientId);
  return (res.meta.changes ?? 0) > 0;
}
