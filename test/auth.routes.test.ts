import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestDatabase, MockD1Database } from './helpers/mock-d1';
import { registerUser, createPasswordResetToken } from '../src/services/auth.service';
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
      expect(html).toContain('name="email"');
      expect(html).toContain('name="password"');
    });

    it('GET /register returns 200 with HTML form', async () => {
      const res = await app.request('/register', {}, mockEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Create a new account');
      expect(html).toContain('name="confirm_password"');
    });

    it('GET /forgot-password returns 200 with HTML form', async () => {
      const res = await app.request('/forgot-password', {}, mockEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Reset your password');
    });
  });

  describe('POST /register', () => {
    it('rejects registration when passwords do not match', async () => {
      const formData = new URLSearchParams({
        email: 'user1@example.com',
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

    it('registers user successfully and renders verification prompt', async () => {
      const formData = new URLSearchParams({
        email: 'reg_success@example.com',
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

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Account created!');
    });
  });

  describe('POST /login', () => {
    it('sets HttpOnly session cookie on successful login', async () => {
      await registerUser(db, 'signin@example.com', 'ValidPassword123!');

      const formData = new URLSearchParams({
        email: 'signin@example.com',
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
        email: 'signin@example.com',
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
      expect(html).toContain('Invalid email or password');
    });

    it('prevents Open Redirect by sanitizing external return_to urls to /', async () => {
      await registerUser(db, 'safe_redirect@example.com', 'ValidPassword123!');

      const evilFormData = new URLSearchParams({
        email: 'safe_redirect@example.com',
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
        email: 'safe_redirect@example.com',
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
        email: 'safe_redirect@example.com',
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

  describe('GET /verify-email', () => {
    it('verifies email with valid token parameter', async () => {
      const { verificationToken } = await registerUser(
        db,
        'toverify@example.com',
        'Password123!'
      );

      const res = await app.request(`/verify-email?token=${verificationToken}`, {}, mockEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Email verified!');
    });

    it('returns 400 on invalid token parameter', async () => {
      const res = await app.request('/verify-email?token=invalid_token_123', {}, mockEnv);
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('Verification Failed');
    });
  });

  describe('Password Reset Web Flow', () => {
    it('handles /forgot-password submission and /reset-password submission', async () => {
      await registerUser(db, 'forgot@example.com', 'OldPassword123!');
      const resetTokenData = await createPasswordResetToken(db, 'forgot@example.com');
      const token = resetTokenData!.token;

      // POST /forgot-password
      const forgotFormData = new URLSearchParams({
        email: 'forgot@example.com',
      });
      const postForgot = await app.request(
        '/forgot-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: forgotFormData.toString(),
        },
        mockEnv
      );
      expect(postForgot.status).toBe(200);
      const forgotHtml = await postForgot.text();
      expect(forgotHtml).toContain('instructions have been sent');

      // GET /reset-password
      const getReset = await app.request(`/reset-password?token=${token}`, {}, mockEnv);
      expect(getReset.status).toBe(200);

      // POST /reset-password
      const formData = new URLSearchParams({
        token,
        password: 'BrandNewPassword123!',
        confirm_password: 'BrandNewPassword123!',
      });

      const postReset = await app.request(
        '/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        },
        mockEnv
      );

      expect(postReset.status).toBe(200);
      const html = await postReset.text();
      expect(html).toContain('Your password has been reset successfully');
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
});
