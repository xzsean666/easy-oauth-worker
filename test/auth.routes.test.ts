import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { registerUser, enableTotp } from '../src/services/auth.service';
import { generateTotpSecret, generateTotp } from '../src/crypto/totp';
import type { Bindings } from '../src/types/env';

describe('Auth Routes and Web UI Integration Tests', () => {
  let db: MockD1Database;
  let mockEnv: Bindings;

  beforeEach(() => {
    db = createTestDatabase();
    mockEnv = {
      DB: db,
      AUTH_URL: 'http://localhost:8787',
      SITE_NAME: 'EasyOAuth Test',
    };
  });

  describe('GET view pages', () => {
    it('GET /login returns 200 with HTML form', async () => {
      const res = await app.request('/login', {}, mockEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Sign in to your account');
      expect(html).toContain('name="username"');
      expect(html).toContain('name="password"');
    });

    it('GET /register returns 200 with HTML form', async () => {
      const res = await app.request('/register', {}, mockEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Create a new account');
      expect(html).toContain('name="username"');
      expect(html).toContain('name="confirm_password"');
    });

    it('GET /forgot-password returns 200 with HTML form', async () => {
      const res = await app.request('/forgot-password', {}, mockEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Reset your password');
      expect(html).toContain('name="username"');
      expect(html).toContain('name="totp_code"');
    });
  });

  describe('POST /register', () => {
    it('rejects registration when passwords do not match', async () => {
      const formData = new URLSearchParams({
        username: 'user_mismatch',
        password: 'Password123!',
        confirm_password: 'PasswordMismatch!',
      });

      const res = await app.request(
        '/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('Passwords do not match');
    });

    it('registers user successfully, creates session and redirects to /account/security', async () => {
      const formData = new URLSearchParams({
        username: 'reg_success_user',
        password: 'Password123!',
        confirm_password: 'Password123!',
      });

      const res = await app.request(
        '/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/account/security');
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('easy_session=sess_');
    });
  });

  describe('POST /login', () => {
    it('sets HttpOnly session cookie on successful login', async () => {
      await registerUser(db, 'signin_user', 'ValidPassword123!');

      const formData = new URLSearchParams({
        username: 'signin_user',
        password: 'ValidPassword123!',
      });

      const res = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/');
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('easy_session=sess_');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
    });

    it('returns 400 and renders error on invalid credentials', async () => {
      const formData = new URLSearchParams({
        username: 'signin_user',
        password: 'WrongPassword!',
      });

      const res = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('Invalid username or password');
    });

    it('prevents Open Redirect by sanitizing external return_to urls to /', async () => {
      await registerUser(db, 'safe_redirect_user', 'ValidPassword123!');

      const evilFormData = new URLSearchParams({
        username: 'safe_redirect_user',
        password: 'ValidPassword123!',
        return_to: 'https://evil-phishing.com/steal-creds',
      });

      const evilRes = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: evilFormData.toString(),
        },
        mockEnv
      );

      expect(evilRes.status).toBe(302);
      expect(evilRes.headers.get('Location')).toBe('/');

      // Also verify protocol-relative URL //evil.com
      const protoRelFormData = new URLSearchParams({
        username: 'safe_redirect_user',
        password: 'ValidPassword123!',
        return_to: '//evil-phishing.com',
      });

      const protoRelRes = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: protoRelFormData.toString(),
        },
        mockEnv
      );

      expect(protoRelRes.status).toBe(302);
      expect(protoRelRes.headers.get('Location')).toBe('/');

      // Verify legitimate relative path is preserved
      const validFormData = new URLSearchParams({
        username: 'safe_redirect_user',
        password: 'ValidPassword123!',
        return_to: '/oauth/authorize?client_id=123',
      });

      const validRes = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: validFormData.toString(),
        },
        mockEnv
      );

      expect(validRes.status).toBe(302);
      expect(validRes.headers.get('Location')).toBe('/oauth/authorize?client_id=123');
    });
  });

  describe('GET /logout', () => {
    it('clears session cookie and redirects to /login', async () => {
      const res = await app.request(
        '/logout',
        {
          headers: { Cookie: 'easy_session=sess_dummy' },
        },
        mockEnv
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/login');
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('easy_session=;');
    });
  });

  describe('Account Security & TOTP Recovery Flow', () => {
    it('requires login for /account/security and renders settings when authenticated', async () => {
      // Unauthenticated access redirects
      const unauth = await app.request('/account/security', {}, mockEnv);
      expect(unauth.status).toBe(302);
      expect(unauth.headers.get('Location')).toContain('/login');

      // Register and login to get session
      await registerUser(db, 'security_bob', 'Password123!');
      const loginRes = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ username: 'security_bob', password: 'Password123!' }).toString(),
        },
        mockEnv
      );
      const sessionCookie = loginRes.headers.get('Set-Cookie')?.split(';')[0] || '';

      // Authenticated access returns 200
      const authReq = await app.request(
        '/account/security',
        { headers: { Cookie: sessionCookie } },
        mockEnv
      );
      expect(authReq.status).toBe(200);
      const html = await authReq.text();
      expect(html).toContain('Account Security');
      expect(html).toContain('Google Authenticator (TOTP)');
      expect(html).toContain('<svg');
      expect(html).toContain('Scan QR Code in your Authenticator App');
      expect(html).toContain('Enter setup key manually');
    });

    it('explicitly warns and rejects /forgot-password if user does NOT have TOTP enabled', async () => {
      await registerUser(db, 'unprotected_user', 'OldPassword123!');

      const formData = new URLSearchParams({
        username: 'unprotected_user',
        totp_code: '123456',
        new_password: 'NewStrongPassword123!',
        confirm_password: 'NewStrongPassword123!',
      });

      const res = await app.request(
        '/forgot-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('This account does not have Google Authenticator enabled');
    });

    it('successfully resets password via /forgot-password with valid TOTP code', async () => {
      const { user } = await registerUser(db, 'totp_user', 'OldPassword123!');
      const secret = generateTotpSecret(20);
      const code = await generateTotp(secret);
      await enableTotp(db, user.id, secret, code);

      const resetTotpCode = await generateTotp(secret);
      const formData = new URLSearchParams({
        username: 'totp_user',
        totp_code: resetTotpCode,
        new_password: 'NewPassword123!',
        confirm_password: 'NewPassword123!',
      });

      const res = await app.request(
        '/forgot-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Your password has been reset successfully');
    });
  });
});
