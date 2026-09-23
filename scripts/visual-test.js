import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'docs', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 1. Launch Chrome Headless
const PORT = 9222;
const chromeProc = spawn('/usr/bin/google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1280,800',
  '--hide-scrollbars',
  'about:blank',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('[visual-test] Waiting for Chrome CDP on port', PORT);
  let pageTarget = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      pageTarget = await res.json();
      break;
    } catch {
      await sleep(200);
    }
  }

  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    throw new Error('Failed to connect to Chrome DevTools Protocol');
  }

  console.log('[visual-test] Connected to target:', pageTarget.id);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) {
        reject(new Error(JSON.stringify(data.error)));
      } else {
        resolve(data.result);
      }
    }
  };

  await new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) resolve();
    else ws.onopen = resolve;
  });

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await send('Page.enable');
  await send('Network.enable');

  const setViewport = async (width, height, isMobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
    });
  };

  const capture = async (name) => {
    await sleep(600);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(screenshotsDir, name);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`[visual-test] Saved screenshot: ${name} (${Math.round(data.length * 0.75 / 1024)} KB)`);
  };

  const navigate = async (url) => {
    console.log(`[visual-test] Navigating to: ${url}`);
    await send('Page.navigate', { url });
    await sleep(800);
  };

  // Obtain admin session cookie
  console.log('[visual-test] Authenticating as default admin...');
  const loginRes = await fetch('http://127.0.0.1:8787/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=admin%40example.com&password=AdminPassword123!',
    redirect: 'manual',
  });

  const setCookieHeader = loginRes.headers.get('set-cookie') || '';
  const match = setCookieHeader.match(/easy_session=([^;]+)/);
  const sessionToken = match ? match[1] : '';
  console.log('[visual-test] Got session token:', sessionToken ? `${sessionToken.slice(0, 10)}...` : 'NONE');

  // --- Screen 1: Login Desktop ---
  await setViewport(1280, 800, false);
  await navigate('http://127.0.0.1:8787/login');
  await capture('01_login_desktop.png');

  // --- Screen 2: Login Mobile ---
  await setViewport(375, 812, true);
  await navigate('http://127.0.0.1:8787/login');
  await capture('02_login_mobile.png');

  // --- Screen 3: Register Desktop ---
  await setViewport(1280, 800, false);
  await navigate('http://127.0.0.1:8787/register');
  await capture('03_register_desktop.png');

  // --- Screen 4: Forgot Password Desktop ---
  await navigate('http://127.0.0.1:8787/forgot-password');
  await capture('04_forgot_password_desktop.png');

  // --- Screen 5: Reset Password Form ---
  await navigate('http://127.0.0.1:8787/reset-password?token=demo_valid_token_123');
  await capture('05_reset_password_desktop.png');

  // --- Inject Session Cookie for Authenticated Views ---
  if (sessionToken) {
    await send('Network.setCookie', {
      name: 'easy_session',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
    });
  }

  // --- Screen 6: Admin Overview Dashboard ---
  await setViewport(1280, 800, false);
  await navigate('http://127.0.0.1:8787/admin');
  await capture('06_admin_dashboard_desktop.png');

  // --- Screen 7: Admin User Management Table ---
  await navigate('http://127.0.0.1:8787/admin/users');
  await capture('07_admin_users_desktop.png');

  // --- Screen 8: Admin OAuth Clients Management ---
  await navigate('http://127.0.0.1:8787/admin/clients');
  await capture('08_admin_clients_desktop.png');

  // --- Screen 9: Admin Settings View ---
  await navigate('http://127.0.0.1:8787/admin/settings');
  await capture('09_admin_settings_desktop.png');

  // --- Screen 10: OAuth 2.0 Consent Screen Desktop ---
  const validConsentUrl =
    'http://127.0.0.1:8787/oauth/authorize?client_id=web-app-client&redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback&response_type=code&scope=openid+profile+email&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256';
  await navigate(validConsentUrl);
  await capture('10_oauth_consent_desktop.png');

  // --- Screen 11: OAuth 2.0 Consent Screen Mobile ---
  await setViewport(375, 812, true);
  await navigate(validConsentUrl);
  await capture('11_oauth_consent_mobile.png');

  // --- Screen 12: OAuth Error: Invalid Redirect URI ---
  await setViewport(1280, 800, false);
  const errorConsentUrl =
    'http://127.0.0.1:8787/oauth/authorize?client_id=web-app-client&redirect_uri=https%3A%2F%2Funauthorized-evil-domain.com%2Fcallback&response_type=code&scope=openid&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256';
  await navigate(errorConsentUrl);
  await capture('12_oauth_error_invalid_redirect.png');

  // Close websocket & kill chrome
  ws.close();
  chromeProc.kill();
  console.log('[visual-test] All 12 visual screenshots captured successfully!');
}

main().catch((err) => {
  console.error('[visual-test] Error:', err);
  chromeProc.kill();
  process.exit(1);
});
