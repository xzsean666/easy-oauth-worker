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
});
