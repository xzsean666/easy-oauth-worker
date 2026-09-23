import { Hono } from 'hono';
import type { AppContext } from './types/env';
import { authRoutes } from './routes/auth';
import { oauthRoutes } from './routes/oauth';
import { oidcRoutes } from './routes/oidc';
import { adminApiRoutes } from './routes/admin-api';
import { adminWebRoutes } from './routes/admin-web';

const app = new Hono<AppContext>();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'easy-oauth-worker',
  });
});

app.get('/', (c) => {
  return c.text('easy-oauth-worker is running');
});

app.route('/', authRoutes);
app.route('/', oauthRoutes);
app.route('/', oidcRoutes);
app.route('/', adminApiRoutes);
app.route('/', adminWebRoutes);

export default app;
