import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppContext } from '../types/env';
import {
  registerUser,
  loginWithPassword,
  verifyLogin2fa,
  enableTotp,
  disableTotp,
  resetPasswordWithTotp,
  createVerificationToken,
} from '../services/auth.service';
import { validateSession, revokeSession, createSession } from '../services/session.service';
import { generateTotpSecret, generateTotpUri } from '../crypto/totp';
import { generateQrCodeSvg } from '../crypto/qr';
import { queryFirst } from '../db/client';
import type { VerificationToken } from '../db/schema';
import { LoginView } from '../views/auth/login';
import { Login2faView } from '../views/auth/login-2fa';
import { RegisterView } from '../views/auth/register';
import { ForgotPasswordView } from '../views/auth/forgot-password';
import { SecurityView } from '../views/account/security';
import { rateLimiter } from '../middlewares/rate-limit';

export const SESSION_COOKIE_NAME = 'easy_session';
export const SESSION_COOKIE_MAX_AGE = 7 * 24 * 3600;
export const TWO_FACTOR_COOKIE_NAME = 'easy_2fa_ticket';

export const authRoutes = new Hono<AppContext>();

// Lightweight in-memory rate limiter for authentication endpoints
const authLimiter = rateLimiter({
  maxRequests: 50,
  windowSeconds: 60,
  prefix: 'auth',
  errorMessage: 'Too many attempts. Please try again in a few moments.',
});

// Helper to determine secure flag
function isSecure(url: string): boolean {
  return url.startsWith('https://');
}

/**
 * Sanitizes return_to URL to prevent Open Redirect attacks.
 * Only allows relative paths or same-origin URLs.
 */
export function sanitizeReturnTo(
  returnTo: string | null | undefined,
  currentUrl: string,
  authUrl?: string
): string {
  if (!returnTo) return '/';
  const trimmed = returnTo.trim();
  if (!trimmed) return '/';

  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const reqOrigin = new URL(currentUrl).origin;
    const configuredOrigin = authUrl ? new URL(authUrl).origin : null;

    if (parsed.origin === reqOrigin || (configuredOrigin && parsed.origin === configuredOrigin)) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Malformed URL, fallback to default
  }

  return '/';
}

// GET /login
authRoutes.get('/login', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const rawReturnTo = c.req.query('return_to');
  const safeReturnTo = sanitizeReturnTo(rawReturnTo, c.req.url, c.env.AUTH_URL);

  if (sessionId) {
    const valid = await validateSession(c.env.DB, sessionId);
    if (valid) {
      return c.redirect(safeReturnTo);
    }
  }

  return c.html(
    LoginView({
      siteName: c.env.SITE_NAME,
      returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
    })
  );
});

// POST /login
authRoutes.post('/login', authLimiter, async (c) => {
  const body = await c.req.parseBody();
  const rawUsername =
    (body.username as string) ||
    (body.identifier as string) ||
    '';
  const password = (body.password as string) || '';
  const rawReturnTo = (body.return_to as string) || undefined;
  const safeReturnTo = sanitizeReturnTo(rawReturnTo, c.req.url, c.env.AUTH_URL);
  const userAgent = c.req.header('user-agent') || null;

  try {
    const result = await loginWithPassword(c.env.DB, rawUsername, password, userAgent);

    if (result.requires2fa) {
      // 2FA required: create a short-lived 5-minute ticket
      const ticket = await createVerificationToken(c.env.DB, result.user.id, 'login_2fa', 300);

      setCookie(c, TWO_FACTOR_COOKIE_NAME, ticket, {
        httpOnly: true,
        secure: isSecure(c.req.url),
        path: '/',
        sameSite: 'Lax',
        maxAge: 300,
      });

      const params = new URLSearchParams();
      params.set('ticket', ticket);
      if (safeReturnTo !== '/') {
        params.set('return_to', safeReturnTo);
      }

      return c.redirect(`/login/2fa?${params.toString()}`);
    }

    // Normal login: set session cookie
    setCookie(c, SESSION_COOKIE_NAME, result.session!.id, {
      httpOnly: true,
      secure: isSecure(c.req.url),
      path: '/',
      sameSite: 'Lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    return c.redirect(safeReturnTo);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid credentials';
    c.status(400);
    return c.html(
      LoginView({
        siteName: c.env.SITE_NAME,
        error: errorMsg,
        username: rawUsername,
        returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
      })
    );
  }
});

// GET /login/2fa
authRoutes.get('/login/2fa', async (c) => {
  const ticket = c.req.query('ticket') || getCookie(c, TWO_FACTOR_COOKIE_NAME);
  const rawReturnTo = c.req.query('return_to');
  const safeReturnTo = sanitizeReturnTo(rawReturnTo, c.req.url, c.env.AUTH_URL);

  if (!ticket) {
    return c.redirect('/login');
  }

  return c.html(
    Login2faView({
      siteName: c.env.SITE_NAME,
      ticket,
      returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
    })
  );
});

// POST /login/2fa
authRoutes.post('/login/2fa', authLimiter, async (c) => {
  const body = await c.req.parseBody();
  const ticket = (body.ticket as string) || getCookie(c, TWO_FACTOR_COOKIE_NAME) || '';
  const totpCode = (body.totp_code as string) || '';
  const rawReturnTo = (body.return_to as string) || undefined;
  const safeReturnTo = sanitizeReturnTo(rawReturnTo, c.req.url, c.env.AUTH_URL);
  const userAgent = c.req.header('user-agent') || null;

  if (!ticket) {
    return c.redirect('/login');
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenRecord = await queryFirst<VerificationToken>(
    c.env.DB,
    'SELECT * FROM verification_tokens WHERE token = ? AND type = ?',
    ticket,
    'login_2fa'
  );

  if (!tokenRecord || tokenRecord.used === 1 || tokenRecord.expires_at <= now) {
    c.status(400);
    return c.html(
      Login2faView({
        siteName: c.env.SITE_NAME,
        error: 'Authentication ticket has expired. Please sign in again.',
        ticket,
        returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
      })
    );
  }

  try {
    const { session } = await verifyLogin2fa(c.env.DB, tokenRecord.user_id, totpCode, userAgent);

    // Consume ticket
    await c.env.DB.prepare('UPDATE verification_tokens SET used = 1 WHERE token = ?').bind(ticket).run();
    deleteCookie(c, TWO_FACTOR_COOKIE_NAME, { path: '/' });

    setCookie(c, SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: isSecure(c.req.url),
      path: '/',
      sameSite: 'Lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    return c.redirect(safeReturnTo);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid verification code';
    c.status(400);
    return c.html(
      Login2faView({
        siteName: c.env.SITE_NAME,
        error: errorMsg,
        ticket,
        returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
      })
    );
  }
});

// GET /register
authRoutes.get('/register', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const rawReturnTo = c.req.query('return_to');
  const safeReturnTo = sanitizeReturnTo(rawReturnTo, c.req.url, c.env.AUTH_URL);

  if (sessionId) {
    const valid = await validateSession(c.env.DB, sessionId);
    if (valid) {
      return c.redirect(safeReturnTo);
    }
  }

  return c.html(
    RegisterView({
      siteName: c.env.SITE_NAME,
      returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
    })
  );
});

// POST /register
authRoutes.post('/register', authLimiter, async (c) => {
  const body = await c.req.parseBody();
  const username = ((body.username as string) || '').trim();
  const password = (body.password as string) || '';
  const confirmPassword = (body.confirm_password as string) || '';
  const rawReturnTo = (body.return_to as string) || undefined;
  const safeReturnTo = sanitizeReturnTo(rawReturnTo, c.req.url, c.env.AUTH_URL);

  if (password !== confirmPassword) {
    c.status(400);
    return c.html(
      RegisterView({
        siteName: c.env.SITE_NAME,
        error: 'Passwords do not match',
        username,
        returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
      })
    );
  }

  try {
    const { user } = await registerUser(c.env.DB, username, password);

    // Immediate activation and automatic sign-in
    const session = await createSession(c.env.DB, user.id, c.req.header('user-agent') || null);
    setCookie(c, SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: isSecure(c.req.url),
      path: '/',
      sameSite: 'Lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    const targetUrl = safeReturnTo !== '/' ? safeReturnTo : '/account/security';
    return c.redirect(targetUrl);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to register account';
    c.status(400);
    return c.html(
      RegisterView({
        siteName: c.env.SITE_NAME,
        error: errorMsg,
        username,
        returnTo: safeReturnTo !== '/' ? safeReturnTo : undefined,
      })
    );
  }
});

// GET /account/security
authRoutes.get('/account/security', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return c.redirect('/login?return_to=/account/security');
  }

  const sessionData = await validateSession(c.env.DB, sessionId);
  if (!sessionData) {
    return c.redirect('/login?return_to=/account/security');
  }

  const { user } = sessionData;
  let secret: string | undefined;
  let uri: string | undefined;
  let qrSvg: string | undefined;

  if (user.totp_enabled !== 1) {
    secret = generateTotpSecret(20);
    uri = generateTotpUri(user.username, secret, c.env.SITE_NAME || 'EasyOAuth');
    qrSvg = generateQrCodeSvg(uri);
  }

  return c.html(
    SecurityView({
      siteName: c.env.SITE_NAME,
      user,
      secret,
      uri,
      qrSvg,
    })
  );
});

// POST /account/security/enable-totp
authRoutes.post('/account/security/enable-totp', authLimiter, async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return c.redirect('/login');
  }

  const sessionData = await validateSession(c.env.DB, sessionId);
  if (!sessionData) {
    return c.redirect('/login');
  }

  const body = await c.req.parseBody();
  const secret = (body.secret as string) || '';
  const totpCode = (body.totp_code as string) || '';

  try {
    const updatedUser = await enableTotp(c.env.DB, sessionData.user.id, secret, totpCode);
    return c.html(
      SecurityView({
        siteName: c.env.SITE_NAME,
        user: updatedUser,
        success: 'Google Authenticator 2FA has been successfully enabled! Your account is now secured.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to enable Google Authenticator';
    const uri = generateTotpUri(sessionData.user.username, secret, c.env.SITE_NAME || 'EasyOAuth');
    const qrSvg = generateQrCodeSvg(uri);

    c.status(400);
    return c.html(
      SecurityView({
        siteName: c.env.SITE_NAME,
        user: sessionData.user,
        secret,
        uri,
        qrSvg,
        error: errorMsg,
      })
    );
  }
});

// POST /account/security/disable-totp
authRoutes.post('/account/security/disable-totp', authLimiter, async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return c.redirect('/login');
  }

  const sessionData = await validateSession(c.env.DB, sessionId);
  if (!sessionData) {
    return c.redirect('/login');
  }

  const body = await c.req.parseBody();
  const currentPassword = (body.current_password as string) || '';

  try {
    const updatedUser = await disableTotp(c.env.DB, sessionData.user.id, currentPassword);
    const newSecret = generateTotpSecret(20);
    const newUri = generateTotpUri(updatedUser.username, newSecret, c.env.SITE_NAME || 'EasyOAuth');

    return c.html(
      SecurityView({
        siteName: c.env.SITE_NAME,
        user: updatedUser,
        secret: newSecret,
        uri: newUri,
        success: 'Google Authenticator has been disabled. Note: You will no longer be able to self-service recover your password.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to disable 2FA';
    c.status(400);
    return c.html(
      SecurityView({
        siteName: c.env.SITE_NAME,
        user: sessionData.user,
        error: errorMsg,
      })
    );
  }
});

// GET /forgot-password
authRoutes.get('/forgot-password', (c) => {
  return c.html(
    ForgotPasswordView({
      siteName: c.env.SITE_NAME,
    })
  );
});

// POST /forgot-password
authRoutes.post('/forgot-password', authLimiter, async (c) => {
  const body = await c.req.parseBody();
  const username =
    ((body.username as string) || (body.identifier as string) || '').trim();
  const totpCode = ((body.totp_code as string) || '').trim();
  const newPassword = (body.new_password as string) || '';
  const confirmPassword = (body.confirm_password as string) || '';

  if (newPassword !== confirmPassword) {
    c.status(400);
    return c.html(
      ForgotPasswordView({
        siteName: c.env.SITE_NAME,
        error: 'Passwords do not match',
        username,
      })
    );
  }

  try {
    await resetPasswordWithTotp(c.env.DB, username, totpCode, newPassword);

    return c.html(
      ForgotPasswordView({
        siteName: c.env.SITE_NAME,
        success: 'Your password has been reset successfully! All prior sessions have been revoked. You can now sign in with your new password.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to reset password';
    c.status(400);
    return c.html(
      ForgotPasswordView({
        siteName: c.env.SITE_NAME,
        error: errorMsg,
        username,
      })
    );
  }
});

// POST & GET /logout
const handleLogout = async (c: any) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionId) {
    await revokeSession(c.env.DB, sessionId);
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  deleteCookie(c, TWO_FACTOR_COOKIE_NAME, { path: '/' });
  return c.redirect('/login');
};

authRoutes.get('/logout', handleLogout);
authRoutes.post('/logout', handleLogout);
