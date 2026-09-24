# Project Goal: easy-oauth-worker

## 1. 愿景与定位
`easy-oauth-worker` 是一个基于 Cloudflare Workers 的轻量级、自托管 **Authentication + OAuth 2.0 + OpenID Connect Provider**。

核心目标：
> 让开发者可以快速部署自己的身份认证服务器，并让其他 Web / Mobile / Backend 应用通过标准 OAuth 2.0 / OpenID Connect 协议接入。

产品只负责身份认证与授权，不承担第三方业务系统的业务逻辑。

## 2. 核心功能范围（第一版 V1）

### 2.1 Authentication (账号与会话)
- 纯用户名注册 (Username Register, 3-32位合规字符)
- 纯用户名登录 (Username Login)
- 谷歌身份验证器二次验证 (Google Authenticator RFC 6238 TOTP 2FA)
- 基于 TOTP 验证码的自助离线找回密码 (Forgot Password via TOTP, 零费用，无邮箱/短信依赖)
- 用户登出 (Logout)
- 个人安全中心 (`/account/security`, 自主开启/关闭 TOTP 2FA，内置纯原生 SVG 二维码与 Base32 密钥)
- 会话生命周期管理 (Secure HttpOnly Session Cookie, Revocation)

### 2.2 OAuth 2.0 Provider
- Authorization Code Flow + PKCE（默认强制 PKCE）
- OAuth Client 管理（应用名称、Client ID、Client Secret、Redirect URIs、Scopes）
- 用户授权 Consent 页面
- 授权码生成与单次消费校验
- Access Token 颁发与撤销 (`/oauth/token`, `/oauth/revoke`)

### 2.3 OpenID Connect (OIDC)
- OIDC Discovery: `GET /.well-known/openid-configuration`
- JWKS: `GET /.well-known/jwks.json`
- ID Token 生成与 WebCrypto 签名 (RS256)
- UserInfo 端点: `GET /oauth/userinfo`
- 标准 Scopes: `openid`, `profile` (提供 `preferred_username` 标识)

### 2.4 User Web UI
- Modern / Clean / Responsive 页面 (Hono JSX + Tailwind CSS)
- `/login`, `/login-2fa`, `/register`, `/account/security`, `/forgot-password`, `/oauth/consent`

### 2.5 Admin Console
- 管理后台路由 `/admin`
- Dashboard：用户数、活跃 Session、2FA 绑定用户数、客户端数
- 用户管理：用户搜索与列表、重置密码、启用/停用用户、Revoke Session、删除用户
- Client 管理：创建、查看、编辑、删除 Client，轮换 Client Secret
- 系统基础设置：站点名称、站点 URL、环境信息展示

### 2.6 Offline Security Engine
- 基于 RFC 6238 标准的 TOTP 算法，纯原生 Web Crypto API 实现
- 纯 TypeScript 算法在服务端内嵌生成 SVG 二维码，100% 离线，无第三方图表 API 依赖

## 3. 明确不包含的内容 (Out of Scope for V1)
- 邮箱与短信依赖 (不使用任何付费或第三方 SaaS 邮件/SMS 服务)
- Passkey / WebAuthn
- 多租户组织 (Organizations / Teams)
- 复杂 RBAC 权限体系
- Billing / 计费
- 企业级 SSO (SAML 等)
- 动态客户端注册 (Dynamic Client Registration)
- 第三方社交登录 (Google/GitHub 快捷登录，留作后续拓展)
- 多个 Email 服务商 (V1 仅 Gmail SMTP)
