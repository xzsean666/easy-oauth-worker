# Architecture Specification: easy-oauth-worker

## 1. 运行时与技术选型

- **运行时 (Runtime)**: Cloudflare Workers (兼容 Cloudflare Workers / Workerd 规范)
- **Web 框架 (Web Framework)**: [Hono](https://hono.dev) - 轻量高效、针对 Workers 深度优化，内建 Cookie、中间件以及 JSX 服务端渲染支持
- **数据库 (Database)**: Cloudflare D1 (基于 SQLite 的分布式原生数据库)
- **密码学 (Cryptography)**: 原生 Web Crypto API (`crypto.subtle`)
  - 密码哈希: PBKDF2-SHA256 (带高迭代次数与独立随机盐)
  - PKCE: SHA-256 哈希与 base64url 校验
  - OIDC 签名: RS256 (RSA-SHA256) 密钥对生成、JWT 签名与 JWKS 导出
  - 随机凭据: `crypto.getRandomValues` 生成高熵安全 Token (Session ID, Auth Code, Reset Token 等)
- **邮件通信 (SMTP)**: 基于 Cloudflare Workers Outbound TCP Sockets (`cloudflare:sockets`) 直连 Gmail SMTP (`smtp.gmail.com:465` TLS 或 `587` STARTTLS)
- **用户界面 (Web UI)**: Hono JSX + Tailwind CSS，纯服务端生成现代响应式 HTML，无复杂前端构建开销，开箱即用
- **测试框架 (Testing)**: Vitest (单元测试与逻辑集成测试)

---

## 2. 核心分层架构

```text
src/
├── index.ts               # Worker 入口，应用装配与根路由调度
├── types/                 # 全局类型定义与环境变量绑定 (Env, D1Database, Secrets)
├── db/                    # 数据库交互层
│   ├── schema.ts          # 数据库表结构定义
│   └── client.ts          # D1 辅助方法与查询构建
├── crypto/                # 密码学与安全核心
│   ├── password.ts        # PBKDF2 密码哈希与比对
│   ├── token.ts           # 安全随机 Token 生成
│   ├── pkce.ts            # PKCE code_challenge / code_verifier 校验
│   └── jwt.ts             # JWT (ID Token / Access Token) 生成、签名与 JWKS
├── services/              # 核心业务服务层
│   ├── auth.service.ts    # 用户注册、登录、密码重置、邮箱验证
│   ├── session.service.ts # 会话创建、验证、销毁与 Revoke
│   ├── oauth.service.ts   # OAuth 客户端、授权码生成/消费、Token 颁发
│   ├── oidc.service.ts    # OpenID Connect Discovery 与 Claims 处理
│   ├── user.service.ts    # 用户管理、状态变更
│   └── email.service.ts   # Gmail SMTP 协议客户端与模板渲染
├── routes/                # HTTP 协议与 API 路由
│   ├── auth.ts            # /login, /register, /logout 等认证 API & 表单动作
│   ├── oauth.ts           # /oauth/authorize, /oauth/token, /oauth/revoke
│   ├── oidc.ts            # /.well-known/*, /oauth/userinfo
│   └── admin.ts           # /admin/* 运营控制台 API
├── views/                 # 页面渲染层 (Hono JSX)
│   ├── layout.tsx         # 通用 HTML 骨架与 Tailwind CSS 样式
│   ├── auth/              # 登录、注册、找回密码、邮箱验证视图
│   ├── oauth/             # Consent 授权确认页视图
│   └── admin/             # 管理控制台仪表盘与管理面板视图
└── utils/                 # 工具函数 (Cookie, HTTP 响应封装, 校验)
```

---

## 3. 数据库数据模型设计

```text
users (用户表)
├── id: TEXT PRIMARY KEY
├── email: TEXT UNIQUE NOT NULL
├── password_hash: TEXT NOT NULL
├── password_salt: TEXT NOT NULL
├── email_verified: INTEGER NOT NULL DEFAULT 0
├── is_active: INTEGER NOT NULL DEFAULT 1
├── is_admin: INTEGER NOT NULL DEFAULT 0
├── created_at: INTEGER NOT NULL
└── updated_at: INTEGER NOT NULL

sessions (会话表)
├── id: TEXT PRIMARY KEY
├── user_id: TEXT NOT NULL (FK -> users.id)
├── expires_at: INTEGER NOT NULL
├── created_at: INTEGER NOT NULL
└── user_agent: TEXT

oauth_clients (第三方应用客户端表)
├── client_id: TEXT PRIMARY KEY
├── client_secret: TEXT NOT NULL
├── client_name: TEXT NOT NULL
├── redirect_uris: TEXT NOT NULL (JSON 字符串数组)
├── allowed_scopes: TEXT NOT NULL (JSON 字符串数组)
├── is_public: INTEGER NOT NULL DEFAULT 0 (SPA / Mobile App)
├── created_at: INTEGER NOT NULL
└── updated_at: INTEGER NOT NULL

oauth_authorization_codes (授权码表)
├── code: TEXT PRIMARY KEY
├── client_id: TEXT NOT NULL (FK -> oauth_clients.client_id)
├── user_id: TEXT NOT NULL (FK -> users.id)
├── redirect_uri: TEXT NOT NULL
├── scope: TEXT NOT NULL
├── code_challenge: TEXT NOT NULL
├── code_challenge_method: TEXT NOT NULL
├── expires_at: INTEGER NOT NULL
├── used: INTEGER NOT NULL DEFAULT 0
└── created_at: INTEGER NOT NULL

oauth_tokens (访问与刷新令牌表)
├── id: TEXT PRIMARY KEY
├── client_id: TEXT NOT NULL (FK -> oauth_clients.client_id)
├── user_id: TEXT NOT NULL (FK -> users.id)
├── access_token: TEXT UNIQUE NOT NULL
├── refresh_token: TEXT UNIQUE
├── scope: TEXT NOT NULL
├── expires_at: INTEGER NOT NULL
├── revoked: INTEGER NOT NULL DEFAULT 0
└── created_at: INTEGER NOT NULL

verification_tokens (邮箱验证与密码重置临时凭证表)
├── token: TEXT PRIMARY KEY
├── user_id: TEXT NOT NULL (FK -> users.id)
├── type: TEXT NOT NULL ('verify_email' | 'reset_password')
├── expires_at: INTEGER NOT NULL
├── used: INTEGER NOT NULL DEFAULT 0
└── created_at: INTEGER NOT NULL
```

---

## 4. 关键安全机制规范

1. **PKCE 强制校验**:
   - 遵从 OAuth 2.1 推荐，默认授权码流程均要求 PKCE。
   - 支持 `S256` 算法。
2. **重定向 URL 严格白名单校验**:
   - `redirect_uri` 必须在 Client 的配置列表中完全精准匹配（不使用任意通配符）。
3. **授权码单次消费 (One-time Use)**:
   - 验证成功后立即标记 `used = 1`，再次使用直接拒绝。
4. **安全 Cookie 策略**:
   - 会话 Cookie 必须标记为 `HttpOnly; Secure; SameSite=Lax`。
5. **CSRF 防护**:
   - OAuth 流程必须支持并校验 `state` 参数。
   - 表单提交带有反 CSRF 检查机制或严格 SameSite Cookie 校验。
