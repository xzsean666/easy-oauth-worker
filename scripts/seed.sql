-- Seed data for easy-oauth-worker
-- Default Admin Account:
-- Email: admin@example.com
-- Password: AdminPassword123!
-- Salt: 4c06ba0c674fc1179b81a5d9563476a4
-- Hash: ba48967375500121ef019b4ade1df374ff9e45ec1b81ed58ad867b1e0c863835 (PBKDF2-SHA256, 100,000 iterations)

INSERT OR IGNORE INTO users (
    id,
    email,
    password_hash,
    password_salt,
    email_verified,
    is_active,
    is_admin,
    created_at,
    updated_at
) VALUES (
    'usr_seed_admin_001',
    'admin@example.com',
    'ba48967375500121ef019b4ade1df374ff9e45ec1b81ed58ad867b1e0c863835',
    '4c06ba0c674fc1179b81a5d9563476a4',
    1,
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now')
);

-- 1. Demo Confidential OAuth Client (e.g. Next.js / Node.js Backend App)
-- Client ID: web-app-client
-- Client Secret: secret_web_app_987654321
INSERT OR IGNORE INTO oauth_clients (
    client_id,
    client_secret,
    client_name,
    redirect_uris,
    allowed_scopes,
    is_public,
    created_at,
    updated_at
) VALUES (
    'web-app-client',
    'secret_web_app_987654321',
    'Demo Web Application (Confidential)',
    '["http://localhost:3000/api/auth/callback/easy-oauth", "https://oauth.pstmn.io/v1/callback"]',
    '["openid", "email", "profile"]',
    0,
    strftime('%s', 'now'),
    strftime('%s', 'now')
);

-- 2. Demo Public OAuth Client (e.g. SPA / Mobile App / Vite React)
-- Client ID: spa-client
-- Client Secret: (empty for public clients)
INSERT OR IGNORE INTO oauth_clients (
    client_id,
    client_secret,
    client_name,
    redirect_uris,
    allowed_scopes,
    is_public,
    created_at,
    updated_at
) VALUES (
    'spa-client',
    '',
    'Demo SPA Application (Public)',
    '["http://localhost:5173/callback", "http://localhost:8080/callback"]',
    '["openid", "email", "profile"]',
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now')
);
