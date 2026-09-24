import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { queryFirst, queryAll, execute, executeBatch } from '../src/db/client';
import type { User, Session, OAuthClient } from '../src/db/schema';

describe('Database Schema and D1 Client Tests', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it('initializes all required tables in schema', async () => {
    const tables = await queryAll<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('oauth_clients');
    expect(tableNames).toContain('oauth_authorization_codes');
    expect(tableNames).toContain('oauth_tokens');
    expect(tableNames).toContain('verification_tokens');
  });

  it('performs CRUD operations on users table', async () => {
    const now = Date.now();
    const insertRes = await execute(
      db,
      `INSERT INTO users (id, username, password_hash, password_salt, is_active, is_admin, totp_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'u_1',
      'user_alpha',
      'hash123',
      'salt123',
      1,
      0,
      0,
      now,
      now
    );
    expect(insertRes.meta.changes).toBe(1);

    const user = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', 'u_1');
    expect(user).toBeDefined();
    expect(user?.username).toBe('user_alpha');
    expect(user?.is_active).toBe(1);

    await execute(db, 'UPDATE users SET totp_enabled = 1 WHERE id = ?', 'u_1');
    const updated = await queryFirst<User>(db, 'SELECT totp_enabled FROM users WHERE id = ?', 'u_1');
    expect(updated?.totp_enabled).toBe(1);

    await execute(db, 'DELETE FROM users WHERE id = ?', 'u_1');
    const deleted = await queryFirst<User>(db, 'SELECT * FROM users WHERE id = ?', 'u_1');
    expect(deleted).toBeNull();
  });

  it('enforces unique username constraint on users', async () => {
    const now = Date.now();
    await execute(
      db,
      `INSERT INTO users (id, username, password_hash, password_salt, is_active, is_admin, totp_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'u_1',
      'test_unique_user',
      'hash1',
      'salt1',
      1,
      0,
      0,
      now,
      now
    );

    await expect(
      execute(
        db,
        `INSERT INTO users (id, username, password_hash, password_salt, is_active, is_admin, totp_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'u_2',
        'test_unique_user',
        'hash2',
        'salt2',
        1,
        0,
        0,
        now,
        now
      )
    ).rejects.toThrow();
  });

  it('enforces foreign key constraints and cascade delete', async () => {
    const now = Date.now();
    // Inserting session without existing user should fail due to foreign key
    await expect(
      execute(
        db,
        'INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?)',
        'sess_1',
        'non_existent_user',
        now + 3600,
        now,
        'vitest'
      )
    ).rejects.toThrow();

    // Insert user first
    await execute(
      db,
      `INSERT INTO users (id, username, password_hash, password_salt, is_active, is_admin, totp_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'u_cascade',
      'cascade_user',
      'hash',
      'salt',
      1,
      0,
      0,
      now,
      now
    );

    // Insert session for user
    await execute(
      db,
      'INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?)',
      'sess_1',
      'u_cascade',
      now + 3600,
      now,
      'vitest'
    );

    const session = await queryFirst<Session>(db, 'SELECT * FROM sessions WHERE id = ?', 'sess_1');
    expect(session).toBeDefined();
    expect(session?.user_id).toBe('u_cascade');

    // Deleting user should cascade delete the session
    await execute(db, 'DELETE FROM users WHERE id = ?', 'u_cascade');
    const sessionAfterDelete = await queryFirst<Session>(db, 'SELECT * FROM sessions WHERE id = ?', 'sess_1');
    expect(sessionAfterDelete).toBeNull();
  });

  it('supports executeBatch for atomic operations', async () => {
    const now = Date.now();
    const batchStatements = [
      {
        sql: `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: ['client_1', 'sec_1', 'App 1', JSON.stringify(['http://localhost/cb']), JSON.stringify(['openid']), 0, now, now],
      },
      {
        sql: `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, allowed_scopes, is_public, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: ['client_2', 'sec_2', 'App 2', JSON.stringify(['http://localhost/cb']), JSON.stringify(['openid']), 1, now, now],
      },
    ];

    const results = await executeBatch(db, batchStatements);
    expect(results).toHaveLength(2);

    const clients = await queryAll<OAuthClient>(db, 'SELECT * FROM oauth_clients ORDER BY client_id ASC');
    expect(clients).toHaveLength(2);
    expect(clients[0].client_name).toBe('App 1');
    expect(clients[1].client_name).toBe('App 2');
  });
});
