# easy-oauth-worker

> 🚀 Lightweight, High-Performance, Self-Hosted OAuth 2.0 & OpenID Connect (OIDC) Identity Provider built natively for **Cloudflare Workers** and **Cloudflare D1**.

`easy-oauth-worker` is a production-ready, serverless Identity Provider (IdP) engineered from the ground up to operate within the Cloudflare edge runtime. It provides complete user authentication, OAuth 2.0 PKCE authorization, OpenID Connect discovery and token issuance, administrative control, and native outbound email notifications via Cloudflare TCP Sockets—**with zero heavy third-party framework overhead**.

---

## ✨ Features

- **Standard OAuth 2.0 & PKCE**:
  - RFC 7636 Proof Key for Code Exchange (PKCE) with `S256` mandatory verification for secure public and confidential clients.
  - Authorization Code Grant (`response_type=code`, `grant_type=authorization_code`).
  - Refresh Token flow (`grant_type=refresh_token`) with sliding expiration.
  - Token Revocation endpoint (`RFC 7009` at `/oauth/revoke`).
  - Basic Auth and POST Body client authentication.

- **OpenID Connect (OIDC) 1.0 Provider**:
  - OpenID Provider Configuration Discovery endpoint (`/.well-known/openid-configuration`).
  - JSON Web Key Set endpoint (`/.well-known/jwks.json`).
  - RS256-signed ID Tokens (`id_token`) featuring dynamic in-memory RSA-2048 keypair generation and rotation.
  - UserInfo endpoint (`/oauth/userinfo`) with Bearer token authentication.

- **Modern User Authentication & UI**:
  - Pure username user model (No email, no SMS, zero third-party dependencies or fees).
  - PBKDF2-SHA256 password hashing (100,000 iterations) via native `Web Crypto API` (`crypto.subtle`).
  - HttpOnly, Secure, SameSite session cookies (`easy_session`).
  - Google Authenticator (RFC 6238 TOTP) Two-Factor Authentication (2FA).
  - Self-service password recovery via Google Authenticator OTP code.
  - Personal Security Center (`/account/security`) with dynamic SVG QR code generation and secret display.
  - Clean, responsive server-rendered UI built with **Hono JSX** and Tailwind CSS CDN.

- **Admin Console & Management API**:
  - Visual Admin Web Dashboard at `/admin` (User list, OAuth client list, status badges, action forms).
  - RESTful Admin API under `/api/admin/*` protected by session authentication and `is_admin` role checks.
  - User operations: activate/deactivate, toggle admin status, trigger password resets, delete accounts.
  - Client operations: register confidential or public clients, configure redirect URI whitelists and allowed scopes, delete clients.

- **100% Offline & Zero-Cost Security**:
  - RFC 6238 TOTP implemented entirely with native Web Crypto API (HMAC-SHA1).
  - Built-in pure TypeScript QR code generation (`src/crypto/qr.ts`), eliminating external API or CDN dependencies.
  - Zero external SMS or SMTP services required.

- **Edge Native & Lightweight**:
  - Built with [Hono v4](https://hono.dev/) for high throughput and sub-millisecond cold starts.
  - Fully typed with TypeScript 5.
  - Fully decoupled mock architecture for SQLite testing.

---

## 🏗️ Architecture Overview

```
                      +---------------------------------------+
                      |          Client Application           |
                      |  (Web Backend, SPA, Mobile, Postman)  |
                      +-------------------+-------------------+
                                          |
                      1. /oauth/authorize (PKCE + Scopes)
                                          v
+---------------------------------------------------------------------------------+
|                              easy-oauth-worker                                  |
|                                                                                 |
|  +--------------------+   +-----------------------+   +----------------------+  |
|  |  Auth & UI Views   |   |   OAuth / OIDC Engine |   |     Admin Web & API  |  |
|  |  (/login, /consent)|   |   (/oauth/token, ...) |   |     (/admin, /api)   |  |
|  +---------+----------+   +-----------+-----------+   +----------+-----------+  |
|            |                          |                          |              |
|            +--------------------------+--------------------------+              |
|                                       v                                         |
|                     +-----------------------------------+                       |
|                     |   Crypto & Token Engine (Native)  |                       |
|                     |   - PBKDF2 / SHA-256 Passwords    |                       |
|                     |   - RS256 JWT ID Tokens / JWKS    |                       |
|                     |   - PKCE S256 Verification        |                       |
|                     |   - RFC 6238 TOTP (Web Crypto)    |                       |
|                     |   - Embedded SVG QR Engine        |                       |
|                     +-----------------+-----------------+                       |
|                                       |                                         |
+---------------------------------------+-----------------------------------------+
                                        |
                                        v
                        +-------------------------------+
                        |      Cloudflare D1 SQLite     |
                        |  Users, Sessions, Clients,    |
                        |  Auth Codes, Tokens           |
                        +-------------------------------+
```

---

## 📁 Project Structure

```
easy-oauth-worker/
├── migrations/
│   └── 0001_initial_schema.sql      # D1 SQLite database schema
├── scripts/
│   └── seed.sql                     # Seed script (Default Admin & Demo Clients)
├── src/
│   ├── crypto/                      # Web Crypto API primitives (JWT, PKCE, PBKDF2)
│   ├── db/                          # D1 SQLite client and schema mappings
│   ├── middlewares/                 # Admin authorization & authentication guards
│   ├── routes/                      # Route handlers (auth, oauth, oidc, admin)
│   ├── services/                    # Business logic (auth, session, oauth, oidc, email, admin)
│   ├── types/                       # Environment bindings & TypeScript definitions
│   ├── views/                       # Server-rendered Hono JSX UI templates
│   └── index.ts                     # Worker entry point & route registration
├── test/                            # Comprehensive Vitest test suite (99+ tests)
├── wrangler.toml                    # Cloudflare Worker & D1 configuration
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 20.0.0 (Tested on Node.js 22)
- **Package Manager**: `pnpm` (recommended) or `npm`
- **Cloudflare Wrangler CLI**: Installed as a dev dependency or globally (`npm install -g wrangler`)

### 1. Installation

```bash
git clone https://github.com/xzsean666/easy-oauth-worker.git
cd easy-oauth-worker
pnpm install
```

### 2. Local Configuration

Check `wrangler.toml` for base environment variables:

```toml
name = "easy-oauth-worker"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
AUTH_URL = "http://localhost:8787"
SITE_NAME = "easy-oauth-worker"

[[d1_databases]]
binding = "DB"
database_name = "easy-oauth-db"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "migrations"
```

### 3. Local Database Migration & Seeding

Apply D1 migrations to your local Wrangler state:

```bash
# Apply schema migrations locally
npx wrangler d1 migrations apply easy-oauth-db --local

# (Optional) Seed default admin and demo clients
npx wrangler d1 execute easy-oauth-db --local --file=scripts/seed.sql
```

### 4. Running the Development Server

Start Wrangler in local development mode:

```bash
pnpm run dev
```

Visit `http://localhost:8787` in your browser. You will be greeted with the authentication portal.

---

## 🧪 Testing & Verification

The project includes 100% automated test coverage with 16 distinct test suites and 136 unit/integration/E2E tests, utilizing Node's built-in SQLite engine:

```bash
# Run all unit, integration, and E2E tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run TypeScript typecheck
pnpm run typecheck

# Run headless Chromium E2E visual tests & generate screenshots
pnpm run test:visual
```

> 📸 **Visual Testing & UI/UX Gallery**: Check out [docs/VISUAL_TEST_REPORT.md](docs/VISUAL_TEST_REPORT.md) for 12 high-resolution screenshots covering Desktop & Mobile views (Login, Register, Admin Dashboard, Users, OAuth Clients, Settings, and OAuth 2.0 Consent screen).


---

## 🛡️ Google Authenticator (TOTP) 2FA & Password Recovery (100% Offline & Free)

`easy-oauth-worker` operates on a **Zero-Email, Zero-SMS** architecture. Security and self-service recovery are handled entirely offline via RFC 6238 Time-based One-Time Passwords (TOTP):

### How It Works

1. **User Registration & Login**: Users register with just a unique `username` (3-32 characters) and strong password. No email address or verification link required.
2. **Personal Security Center (`/account/security`)**:
   - Users can choose to enable or disable Two-Factor Authentication (2FA) at any time.
   - Upon setup, an embedded SVG QR code and a Base32 secret key are generated directly in the browser/worker via pure TypeScript without external CDN or Google Chart APIs.
   - Users scan the QR code using Google Authenticator, Microsoft Authenticator, 1Password, or Bitwarden, and confirm with a 6-digit code.
3. **Login Two-Factor Enforcement**:
   - When 2FA is active, logging in requires verifying credentials followed by entering the 6-digit TOTP code (`/login-2fa`).
4. **Self-Service Password Recovery without Email**:
   - If a user forgets their password, they visit `/forgot-password`, provide their username and current 6-digit Google Authenticator code, and set a new password.
   - If 2FA has not been bound, self-service recovery is not possible, and password resets must be performed by the system administrator via the `/admin` portal.

---

## ☁️ Production Deployment

`easy-oauth-worker` 同时支持部署到 **Cloudflare Pages** 与 **Cloudflare Workers**。

### 方式一：部署到 Cloudflare Pages (推荐)

Cloudflare Pages 拥有免费独立的 `.pages.dev` 域名、免费 SSL、全球边缘就近分发以及对静态资源的高性能加速。

#### 1. 一键全自动部署脚本

项目提供了一键自动化部署脚本 [`scripts/deploy-pages.sh`](file:///ssd0/git/easy-oauth-worker/scripts/deploy-pages.sh)，**默认即为秒级极速发布**，直接运行即可发布代码并自动绑定 D1 数据库：

```bash
# ⚡ 极速秒级部署 (默认模式，2~3秒发布，自动绑定已有 D1 数据库)
pnpm run deploy:pages
# 或直接运行
bash scripts/deploy-pages.sh

# 完整自检与迁移模式 (包含类型检查、Vitest 测试套件与 D1 迁移)
bash scripts/deploy-pages.sh --full

# 或部署并灌入初始种子数据
bash scripts/deploy-pages.sh --seed

# 针对重构无邮箱新结构：一键重置远端 D1 并灌入初始种子数据
bash scripts/deploy-pages.sh --reset-db --seed
```

#### 2. 部署脚本参数说明

| 参数 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `-f, --fast` | `true` | **极速模式**（默认行为）：跳过测试与 D1 迁移，非交互式秒级直接发布 Pages |
| `-t, --test` | `false` | 部署前显式运行 TypeScript 检查与 Vitest 测试套件 |
| `-m, --migrate` | `false` | 部署前显式执行远程 D1 数据库 Schema 迁移 |
| `-r, --reset-db` | `false` | **重置远端数据库**：清除旧表并重新应用最新的纯用户名+TOTP纯净Schema |
| `--full` | `false` | 完整自检模式（执行测试、D1 迁移、交互确认） |
| `-p, --project-name` | `easy-oauth-worker` | Cloudflare Pages 项目名称 |
| `-b, --branch` | `main` | 绑定的 Git 分支名称 |
| `-d, --db-name` | `easy-oauth-db` | Cloudflare D1 数据库名称 |
| `-i, --db-id` | `wrangler.toml` | Cloudflare D1 数据库 UUID（自动绑定至 Pages `DB` 变量） |
| `--seed` | `false` | 迁移完成后自动注入初始种子数据 (`scripts/seed.sql`) |
| `-h, --help` | - | 查看命令行帮助信息 |

#### 3. 自动化 D1 持久化绑定机制

脚本内置了 Cloudflare Pages 原生 D1 自动绑定能力：
- 当脚本创建或识别到真实有效的 D1 `database_id`（或通过 `--db-id <UUID>` 传入）时，部署阶段会自动生成兼容 Pages 的专用配置，**自动将 `[[d1_databases]] binding = "DB"` 绑定到 Pages Functions 运行时**，部署完成即刻享有数据库读写能力，**无需在控制台手动绑定**！
- 若因 API Token 缺少 D1 权限导致无法自动建库，可在 Cloudflare Dashboard 创建 D1 数据库后，直接带参运行：
  ```bash
  bash scripts/deploy-pages.sh --db-id <YOUR_D1_UUID>
  ```
  即可一键完成自动绑定与发布！


---

### 方式二：部署到 Cloudflare Workers

#### 1. 创建 Cloudflare D1 生产数据库

```bash
npx wrangler d1 create easy-oauth-db
```

Wrangler 会输出数据库元数据：
```
✅ Successfully created DB 'easy-oauth-db'
{
  binding = "DB",
  database_name = "easy-oauth-db",
  database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

将该 ID 填入 `wrangler.toml` 中的 `database_id`。

#### 2. 执行远程数据库迁移

```bash
npx wrangler d1 migrations apply easy-oauth-db --remote
```

#### 3. 注入初始种子数据 (可选)

```bash
npx wrangler d1 execute easy-oauth-db --remote --file=scripts/seed.sql
```

#### 4. 配置生产域名与密钥并部署 Worker

更新 `wrangler.toml` 中的 `AUTH_URL` 为生产域名，设置密钥后发布：

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put OIDC_SIGNING_KEY

pnpm run deploy
```

---

## 🔑 Default Seed Credentials

When you run `scripts/seed.sql`, the following records are provisioned:

| Type | Identifier | Secret / Password | Description |
| :--- | :--- | :--- | :--- |
| **Admin User** | `admin` | `AdminPassword123!` | System administrator with full `/admin` access |
| **Confidential Client** | `web-app-client` | `secret_web_app_987654321` | Demo server-side web application |
| **Public Client** | `spa-client` | *(None / Public)* | Demo single-page / mobile application |

> ⚠️ **Important**: In production, immediately log in as the default admin and change the password, or delete the seed user!

---

## 🔌 Third-Party Client Integration

### 1. OpenID Connect Discovery

Third-party client libraries (such as NextAuth.js, OpenID Connect client, Keycloak, Postman) can automatically discover all configuration endpoints:

```
GET https://auth.yourdomain.com/.well-known/openid-configuration
```

Example response:
```json
{
  "issuer": "https://auth.yourdomain.com",
  "authorization_endpoint": "https://auth.yourdomain.com/oauth/authorize",
  "token_endpoint": "https://auth.yourdomain.com/oauth/token",
  "userinfo_endpoint": "https://auth.yourdomain.com/oauth/userinfo",
  "jwks_uri": "https://auth.yourdomain.com/.well-known/jwks.json",
  "revocation_endpoint": "https://auth.yourdomain.com/oauth/revoke",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile"],
  "claims_supported": ["sub", "iss", "aud", "exp", "iat", "auth_time", "preferred_username"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256"]
}
```

### 2. NextAuth.js / Auth.js Integration Example

In your Next.js application (`pages/api/auth/[...nextauth].ts` or `app/api/auth/[...nextauth]/route.ts`):

```typescript
import NextAuth from "next-auth";

export default NextAuth({
  providers: [
    {
      id: "easy-oauth",
      name: "Easy OAuth",
      type: "oauth",
      wellKnown: "https://auth.yourdomain.com/.well-known/openid-configuration",
      authorization: { params: { scope: "openid profile" } },
      clientId: "web-app-client",
      clientSecret: "secret_web_app_987654321",
      idToken: true,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.preferred_username,
        };
      },
    },
  ],
});
```

### 3. Native OAuth 2.0 PKCE Flow (Single Page Applications)

1. **Generate PKCE Parameters**:
   - `code_verifier`: 43–128 character cryptographically random string.
   - `code_challenge`: `BASE64URL-ENCODE(SHA256(code_verifier))`.
2. **Redirect to Authorization URL**:
   ```
   https://auth.yourdomain.com/oauth/authorize?
     response_type=code
     &client_id=spa-client
     &redirect_uri=https://myapp.com/callback
     &scope=openid profile
     &state=xyz123
     &code_challenge=E9Melhoa2OwvFrGMTJguCH5rtx64Znqi60hZu35e369
     &code_challenge_method=S256
   ```
3. **Exchange Code for Tokens at `/oauth/token`**:
   ```bash
   curl -X POST https://auth.yourdomain.com/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "client_id=spa-client" \
     -d "redirect_uri=https://myapp.com/callback" \
     -d "code=CODE_RETURNED_FROM_CALLBACK" \
     -d "code_verifier=ORIGINAL_CODE_VERIFIER"
   ```

---

## 📚 Endpoints Reference

### Public & Authentication Endpoints
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Home page / redirect to login |
| `GET` | `/health` | Healthcheck and service status endpoint |
| `GET/POST`| `/login` | User login page & credential verification |
| `GET/POST`| `/login-2fa` | Two-Factor Authentication TOTP verification page |
| `GET/POST`| `/register` | User registration page (zero-email) |
| `GET` | `/logout` | Session invalidation and cookie removal |
| `GET/POST`| `/account/security` | Personal Security Center (View & Toggle Google Authenticator 2FA) |
| `GET/POST`| `/forgot-password` | Offline self-service password recovery using Google Authenticator TOTP |

### OAuth 2.0 & OIDC Endpoints
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/.well-known/openid-configuration` | OpenID Connect Discovery metadata |
| `GET` | `/.well-known/jwks.json` | Public RSA JSON Web Key Set |
| `GET` | `/oauth/authorize` | Authorization endpoint (PKCE & Scope validation) |
| `POST`| `/oauth/consent` | User consent decision processing |
| `POST`| `/oauth/token` | Token issuance (Authorization Code & Refresh Token) |
| `GET/POST`| `/oauth/userinfo` | Authenticated user profile retrieval (`sub`, `preferred_username`) |
| `POST`| `/oauth/revoke` | Revoke active access or refresh tokens |

### Admin Console & APIs (Admin Session Required)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/admin` | Visual Admin Web Console |
| `POST`| `/admin/users/:id/toggle-active` | Activate or deactivate user |
| `POST`| `/admin/users/:id/toggle-admin` | Toggle administrator privileges |
| `POST`| `/admin/users/:id/reset-password`| Set a new user password |
| `POST`| `/admin/users/:id/delete` | Delete user and cascade dependent data |
| `POST`| `/admin/clients` | Register a new OAuth Client |
| `POST`| `/admin/clients/:id/delete` | Remove an OAuth Client |
| `GET` | `/api/admin/users` | List paginated users (JSON) |
| `GET` | `/api/admin/clients` | List registered OAuth clients (JSON) |

---

## 📄 License

MIT © [xzsean666](https://github.com/xzsean666)
