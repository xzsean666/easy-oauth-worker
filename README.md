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
  - User self-registration and secure login.
  - PBKDF2-SHA256 password hashing (100,000 iterations) via native `Web Crypto API` (`crypto.subtle`).
  - HttpOnly, Secure, SameSite session cookies (`easy_session`).
  - Email verification and forgot/reset password workflows.
  - Clean, responsive server-rendered UI built with **Hono JSX** and Tailwind CSS CDN.

- **Admin Console & Management API**:
  - Visual Admin Web Dashboard at `/admin` (User list, OAuth client list, status badges, action forms).
  - RESTful Admin API under `/api/admin/*` protected by session authentication and `is_admin` role checks.
  - User operations: activate/deactivate, toggle admin status, trigger password resets, delete accounts.
  - Client operations: register confidential or public clients, configure redirect URI whitelists and allowed scopes, delete clients.

- **Direct Socket Outbound Email (Gmail SMTP)**:
  - Zero third-party SaaS email dependency (no Resend/SendGrid API keys required).
  - Employs Cloudflare Workers native `cloudflare:sockets` for direct TLS/SSL communication over port 465 with `smtp.gmail.com`.
  - Beautiful, responsive HTML email templates for account activation and password resets.

- **Edge Native & Lightweight**:
  - Built with [Hono v4](https://hono.dev/) for high throughput and sub-millisecond cold starts.
  - Fully typed with TypeScript 5.
  - Fully decoupled mock architecture for SQLite and socket testing.

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
|                     +-----------------+-----------------+                       |
|                                       |                                         |
+---------------------------------------+-----------------------------------------+
                    |                                       |
                    v                                       v
    +-------------------------------+       +-------------------------------+
    |      Cloudflare D1 SQLite     |       |    Gmail SMTP (TCP Sockets)   |
    |  Users, Sessions, Clients,    |       |  Port 465 Direct TLS Mailer   |
    |  Auth Codes, Tokens           |       +-------------------------------+
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
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = "465"

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

The project includes 100% automated test coverage with 12 distinct test suites and 99 unit/integration/E2E tests, utilizing Node's built-in SQLite engine:

```bash
# Run all unit, integration, and E2E tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run TypeScript typecheck
pnpm run typecheck
```

---

## 🔒 Gmail SMTP Configuration (Outbound Email)

`easy-oauth-worker` sends verification emails and password reset links via direct TLS TCP Sockets (`cloudflare:sockets`) to `smtp.gmail.com:465`.

### Generating a Google Account App Password

1. Log into your Google Account and navigate to [Google Account Security](https://myaccount.google.com/security).
2. Enable **2-Step Verification** (if not already enabled).
3. Under the "How you sign in to Google" section, search for **App passwords** (or go directly to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
4. Enter an App name (e.g., `EasyOAuth Worker`) and click **Create**.
5. Copy the generated 16-character password (e.g. `abcd efgh ijkl mnop`).

### Storing Secrets in Cloudflare Workers

Store your credentials securely in Cloudflare using Wrangler secrets:

```bash
# Set your Gmail address (e.g., myaccount@gmail.com)
npx wrangler secret put SMTP_USERNAME

# Set your 16-character Google App Password (without spaces)
npx wrangler secret put SMTP_PASSWORD
```

For local development with email sending, you can also create a `.dev.vars` file in the project root:

```ini
SMTP_USERNAME="myaccount@gmail.com"
SMTP_PASSWORD="your16charpassword"
```

> **Note**: If `SMTP_USERNAME` and `SMTP_PASSWORD` are not configured, the service will log an informative warning and permit authentication flows to proceed without crashing.

---

## ☁️ Production Deployment

### 1. Create Cloudflare D1 Production Database

```bash
npx wrangler d1 create easy-oauth-db
```

Wrangler will output the database details:
```
✅ Successfully created DB 'easy-oauth-db'
{
  binding = "DB",
  database_name = "easy-oauth-db",
  database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Update the `database_id` under `[[d1_databases]]` in `wrangler.toml` with this ID.

### 2. Apply Schema Migrations to Production

```bash
npx wrangler d1 migrations apply easy-oauth-db --remote
```

### 3. Initialize Production Seed Data (Optional)

```bash
npx wrangler d1 execute easy-oauth-db --remote --file=scripts/seed.sql
```

### 4. Update Production Domain

Update `AUTH_URL` in `wrangler.toml` to your production domain (e.g. `https://auth.yourdomain.com`).

### 5. Deploy the Worker

```bash
pnpm run deploy
```

---

## 🔑 Default Seed Credentials

When you run `scripts/seed.sql`, the following records are provisioned:

| Type | Identifier | Secret / Password | Description |
| :--- | :--- | :--- | :--- |
| **Admin User** | `admin@example.com` | `AdminPassword123!` | System administrator with full `/admin` access |
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
  "scopes_supported": ["openid", "email", "profile"],
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
      authorization: { params: { scope: "openid email profile" } },
      clientId: "web-app-client",
      clientSecret: "secret_web_app_987654321",
      idToken: true,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.email,
          email: profile.email,
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
     &scope=openid email profile
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
| `GET/POST`| `/register` | User registration page & account creation |
| `GET` | `/logout` | Session invalidation and cookie removal |
| `GET/POST`| `/forgot-password` | Password reset request form & dispatch |
| `GET/POST`| `/reset-password` | Password update form using reset token |
| `GET` | `/verify-email` | Email confirmation verification link |

### OAuth 2.0 & OIDC Endpoints
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/.well-known/openid-configuration` | OpenID Connect Discovery metadata |
| `GET` | `/.well-known/jwks.json` | Public RSA JSON Web Key Set |
| `GET` | `/oauth/authorize` | Authorization endpoint (PKCE & Scope validation) |
| `POST`| `/oauth/consent` | User consent decision processing |
| `POST`| `/oauth/token` | Token issuance (Authorization Code & Refresh Token) |
| `GET/POST`| `/oauth/userinfo` | Authenticated user profile retrieval |
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
