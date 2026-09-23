import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppContext } from '../types/env';
import {
  registerUser,
  loginWithPassword,
  verifyEmailToken,
  createPasswordResetToken,
  resetPasswordWithToken,
} from '../services/auth.service';
import { validateSession, revokeSession } from '../services/session.service';
import { LoginView } from '../views/auth/login';
import { RegisterView } from '../views/auth/register';
import { ForgotPasswordView } from '../views/auth/forgot-password';
import { ResetPasswordView } from '../views/auth/reset-password';
import { VerifyEmailView } from '../views/auth/verify-email';

export const SESSION_COOKIE_NAME = 'easy_session';
export const SESSION_COOKIE_MAX_AGE = 7 * 24 * 3600;

export const authRoutes = new Hono<AppContext>();

// Helper to determine secure flag
function isSecure(url: string): boolean {
  return url.startsWith('https://');
}

// GET /login
authRoutes.get('/login', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const returnTo = c.req.query('return_to');

  if (sessionId) {
    const valid = await validateSession(c.env.DB, sessionId);
    if (valid) {
      return c.redirect(returnTo || '/');
    }
  }

  return c.html(
    LoginView({
      siteName: c.env.SITE_NAME,
      returnTo,
    })
  );
});

// POST /login
authRoutes.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email = (body.email as string) || '';
  const password = (body.password as string) || '';
  const returnTo = (body.return_to as string) || undefined;
  const userAgent = c.req.header('user-agent') || null;

  try {
    const { session } = await loginWithPassword(c.env.DB, email, password, userAgent);

    setCookie(c, SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: isSecure(c.req.url),
      path: '/',
      sameSite: 'Lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    return c.redirect(returnTo || '/');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid credentials';
    c.status(400);
    return c.html(
      LoginView({
        siteName: c.env.SITE_NAME,
        error: errorMsg,
        email,
        returnTo,
      })
    );
  }
});

// GET /register
authRoutes.get('/register', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  const returnTo = c.req.query('return_to');

  if (sessionId) {
    const valid = await validateSession(c.env.DB, sessionId);
    if (valid) {
      return c.redirect(returnTo || '/');
    }
  }

  return c.html(
    RegisterView({
      siteName: c.env.SITE_NAME,
      returnTo,
    })
  );
});

// POST /register
authRoutes.post('/register', async (c) => {
  const body = await c.req.parseBody();
  const email = (body.email as string) || '';
  const password = (body.password as string) || '';
  const confirmPassword = (body.confirm_password as string) || '';
  const returnTo = (body.return_to as string) || undefined;

  if (password !== confirmPassword) {
    c.status(400);
    return c.html(
      RegisterView({
        siteName: c.env.SITE_NAME,
        error: 'Passwords do not match',
        email,
        returnTo,
      })
    );
  }

  try {
    await registerUser(c.env.DB, email, password);

    return c.html(
      VerifyEmailView({
        siteName: c.env.SITE_NAME,
        status: 'pending',
        message: 'Account created! Please check your email inbox to verify your account before logging in.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to register account';
    c.status(400);
    return c.html(
      RegisterView({
        siteName: c.env.SITE_NAME,
        error: errorMsg,
        email,
        returnTo,
      })
    );
  }
});

// GET /verify-email
authRoutes.get('/verify-email', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    c.status(400);
    return c.html(
      VerifyEmailView({
        siteName: c.env.SITE_NAME,
        status: 'error',
        message: 'Missing verification token parameter.',
      })
    );
  }

  try {
    await verifyEmailToken(c.env.DB, token);
    return c.html(
      VerifyEmailView({
        siteName: c.env.SITE_NAME,
        status: 'success',
        message: 'Your email address has been successfully verified! You may now sign in.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid or expired verification token';
    c.status(400);
    return c.html(
      VerifyEmailView({
        siteName: c.env.SITE_NAME,
        status: 'error',
        message: errorMsg,
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
authRoutes.post('/forgot-password', async (c) => {
  const body = await c.req.parseBody();
  const email = (body.email as string) || '';

  try {
    await createPasswordResetToken(c.env.DB, email);
  } catch {
    // Suppress errors to avoid account enumeration
  }

  return c.html(
    ForgotPasswordView({
      siteName: c.env.SITE_NAME,
      success: 'If an account exists with that email, instructions have been sent.',
      email,
    })
  );
});

// GET /reset-password
authRoutes.get('/reset-password', (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.redirect('/login');
  }

  return c.html(
    ResetPasswordView({
      siteName: c.env.SITE_NAME,
      token,
    })
  );
});

// POST /reset-password
authRoutes.post('/reset-password', async (c) => {
  const body = await c.req.parseBody();
  const token = (body.token as string) || '';
  const password = (body.password as string) || '';
  const confirmPassword = (body.confirm_password as string) || '';

  if (!token) {
    return c.redirect('/login');
  }

  if (password !== confirmPassword) {
    c.status(400);
    return c.html(
      ResetPasswordView({
        siteName: c.env.SITE_NAME,
        token,
        error: 'Passwords do not match',
      })
    );
  }

  try {
    await resetPasswordWithToken(c.env.DB, token, password);

    return c.html(
      ResetPasswordView({
        siteName: c.env.SITE_NAME,
        token,
        success: 'Your password has been reset successfully.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to reset password';
    c.status(400);
    return c.html(
      ResetPasswordView({
        siteName: c.env.SITE_NAME,
        token,
        error: errorMsg,
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
  return c.redirect('/login');
};

authRoutes.get('/logout', handleLogout);
authRoutes.post('/logout', handleLogout);
