import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('Health Check Endpoint', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string; service: string; timestamp: number };
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('service', 'easy-oauth-worker');
    expect(typeof data.timestamp).toBe('number');
  });

  it('GET / returns 200 with service message', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('easy-oauth-worker is running');
  });

  it('sets global security headers on responses', async () => {
    const res = await app.request('/health');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('supports CORS on public OIDC discovery endpoint including OPTIONS preflight', async () => {
    // GET request
    const getRes = await app.request('/.well-known/openid-configuration');
    expect(getRes.headers.get('Access-Control-Allow-Origin')).toBe('*');

    // OPTIONS preflight request
    const optionsRes = await app.request('/oauth/token', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://consumer-spa.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns structured JSON 404 for API endpoints', async () => {
    const res = await app.request('/api/unknown/endpoint');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('not_found');
  });
});

describe('Database Cleanup Task', () => {
  it('cleans up expired sessions and verification tokens', async () => {
    const { createTestDatabase } = await import('./helpers/mock-d1');
    const { cleanupExpiredData } = await import('../src/index');
    const db = createTestDatabase();

    const now = Math.floor(Date.now() / 1000);
    // Insert user first to satisfy foreign key constraint
    await db.prepare('INSERT INTO users (id, email, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('usr_1', 'user1@example.com', 'hash', 'salt', now, now)
      .run();

    // Insert an expired session and a valid session
    await db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind('sess_expired', 'usr_1', now - 100, now - 1000)
      .run();
    await db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind('sess_valid', 'usr_1', now + 1000, now)
      .run();

    const stats = await cleanupExpiredData(db);
    expect(stats.sessionsDeleted).toBe(1);

    const remaining = await db.prepare('SELECT id FROM sessions').all();
    expect(remaining.results?.length).toBe(1);
    expect(remaining.results?.[0].id).toBe('sess_valid');
  });
});
