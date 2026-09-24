import { queryFirst, queryAll, execute } from '../db/client';
import type { User, OAuthClient } from '../db/schema';
import { generateId, generateRandomToken } from '../crypto/token';
import { revokeAllUserSessions } from './session.service';

export interface DashboardStats {
  totalUsers: number;
  totpUsers: number;
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

  const totpUsersRow = await queryFirst<{ count: number }>(
    db,
    'SELECT COUNT(*) as count FROM users WHERE totp_enabled = 1'
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
    totpUsers: totpUsersRow?.count ?? 0,
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
    SELECT id, username, is_active, is_admin, totp_enabled, created_at, updated_at
    FROM users
  `;
  const params: unknown[] = [];

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`;
    countSql += ' WHERE LOWER(username) LIKE ?';
    querySql += ' WHERE LOWER(username) LIKE ?';
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
 * Updates a user's flags (is_active, is_admin).
 */
export async function updateUserStatus(
  db: D1Database,
  userId: string,
  updates: { is_active?: number; is_admin?: number },
  currentAdminId?: string
): Promise<SafeUser> {
  const user = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (currentAdminId && userId === currentAdminId) {
    if (updates.is_admin !== undefined && updates.is_admin === 0) {
      throw new Error('You cannot remove administrator privileges from your own account');
    }
    if (updates.is_active !== undefined && updates.is_active === 0) {
      throw new Error('You cannot disable your own account');
    }
  }

  const newIsActive = updates.is_active !== undefined ? updates.is_active : user.is_active;
  const newIsAdmin = updates.is_admin !== undefined ? updates.is_admin : user.is_admin;
  const now = Math.floor(Date.now() / 1000);

  await execute(
    db,
    'UPDATE users SET is_active = ?, is_admin = ?, updated_at = ? WHERE id = ?',
    newIsActive,
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
    username: user.username,
    is_active: newIsActive,
    is_admin: newIsAdmin,
    totp_secret: user.totp_secret,
    totp_enabled: user.totp_enabled ?? 0,
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
    throw new Error('You cannot delete your own account');
  }

  const user = await queryFirst<User>(db, 'SELECT id FROM users WHERE id = ?', userId);
  if (!user) {
    throw new Error('User not found');
  }

  await revokeAllUserSessions(db, userId);
  await execute(db, 'DELETE FROM users WHERE id = ?', userId);
  return true;
}

/**
 * Lists all OAuth clients.
 */
export async function listClients(db: D1Database): Promise<OAuthClient[]> {
  return queryAll<OAuthClient>(
    db,
    'SELECT * FROM oauth_clients ORDER BY created_at DESC'
  );
}

/**
 * Creates a new OAuth client.
 */
export async function createClient(
  db: D1Database,
  params: {
    clientName: string;
    redirectUris: string[];
    allowedScopes?: string[];
    isPublic?: boolean;
  }
): Promise<{ client: OAuthClient; secret: string }> {
  const clientId = generateId('client');
  const secret = generateRandomToken(32);
  const now = Math.floor(Date.now() / 1000);
  const scopes = params.allowedScopes && params.allowedScopes.length > 0 ? params.allowedScopes : ['openid', 'profile'];

  await execute(
    db,
    `INSERT INTO oauth_clients (
      client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    clientId,
    secret,
    params.clientName.trim(),
    JSON.stringify(params.redirectUris),
    JSON.stringify(scopes),
    params.isPublic ? 1 : 0,
    now,
    now
  );

  const client = await queryFirst<OAuthClient>(
    db,
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    clientId
  );

  return { client: client!, secret };
}

/**
 * Rotates an OAuth client's secret.
 */
export async function rotateClientSecret(
  db: D1Database,
  clientId: string
): Promise<{ client: OAuthClient; newSecret: string }> {
  const newSecret = generateRandomToken(32);
  const now = Math.floor(Date.now() / 1000);

  await execute(
    db,
    'UPDATE oauth_clients SET client_secret = ?, updated_at = ? WHERE client_id = ?',
    newSecret,
    now,
    clientId
  );

  const updatedClient = await queryFirst<OAuthClient>(
    db,
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    clientId
  );

  if (!updatedClient) {
    throw new Error('OAuth client not found');
  }

  return { client: updatedClient, newSecret };
}

/**
 * Updates an OAuth client's basic configuration.
 */
export async function updateClient(
  db: D1Database,
  clientId: string,
  params: {
    clientName?: string;
    redirectUris?: string[];
    allowedScopes?: string[];
    isPublic?: boolean;
  }
): Promise<OAuthClient> {
  const existing = await queryFirst<OAuthClient>(
    db,
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    clientId
  );
  if (!existing) {
    throw new Error('OAuth client not found');
  }

  const now = Math.floor(Date.now() / 1000);
  const clientName = params.clientName ? params.clientName.trim() : existing.client_name;
  const redirectUris = params.redirectUris ? JSON.stringify(params.redirectUris) : existing.redirect_uris;
  const allowedScopes = params.allowedScopes ? JSON.stringify(params.allowedScopes) : existing.allowed_scopes;
  const isPublic = params.isPublic !== undefined ? (params.isPublic ? 1 : 0) : existing.is_public;

  await execute(
    db,
    `UPDATE oauth_clients 
     SET client_name = ?, redirect_uris = ?, allowed_scopes = ?, is_public = ?, updated_at = ? 
     WHERE client_id = ?`,
    clientName,
    redirectUris,
    allowedScopes,
    isPublic,
    now,
    clientId
  );

  const updated = await queryFirst<OAuthClient>(
    db,
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    clientId
  );
  return updated!;
}

/**
 * Deletes an OAuth client.
 */
export async function deleteClient(
  db: D1Database,
  clientId: string
): Promise<boolean> {
  const client = await queryFirst<OAuthClient>(
    db,
    'SELECT client_id FROM oauth_clients WHERE client_id = ?',
    clientId
  );
  if (!client) {
    throw new Error('OAuth client not found');
  }

  await execute(db, 'DELETE FROM oauth_clients WHERE client_id = ?', clientId);
  return true;
}
