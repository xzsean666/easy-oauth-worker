# Project Goal: easy-oauth-worker

## 1. 愿景与定位
`easy-oauth-worker` 是一个基于 Cloudflare Workers 的轻量级、自托管 **Authentication + OAuth 2.0 + OpenID Connect Provider**。

核心目标：
> 让开发者可以快速部署自己的身份认证服务器，并让其他 Web / Mobile / Backend 应用通过标准 OAuth 2.0 / OpenID Connect 协议接入。

产品只负责身份认证与授权，不承担第三方业务系统的业务逻辑。

## 2. 核心功能范围（第一版 V1）

### 2.1 Authentication (账号与会话)
- 邮箱注册 (Email Register)
- 邮箱登录 (Email Login)
- 邮箱验证链接 (Email Verification)
- 忘记密码 / 找回密码 (Forgot Password)
- 重置密码 (Reset Password)
- 修改密码 (Change Password)
- 用户登出 (Logout)
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
- ID Token 生成与 WebCrypto 签名 (RS256/ES256)
- UserInfo 端点: `GET /oauth/userinfo`
- 标准 Scopes: `openid`, `profile`, `email`

### 2.4 User Web UI
- Modern / Clean / Responsive 页面 (Tailwind CSS)
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/oauth/consent`

### 2.5 Admin Console
- 管理后台路由 `/admin`
- Dashboard：用户数、活跃 Session、已验证用户数、客户端数
- 用户管理：用户搜索与列表、用户详情、手动验证邮箱、启用/停用用户、Revoke Session、删除用户
- Client 管理：创建、查看、编辑、删除 Client，轮换 Client Secret
- 系统基础设置：站点名称、站点 URL、SMTP 基础配置信息展示

### 2.6 Email Service
- 第一版专用 Gmail SMTP
- 基于 Cloudflare Workers TCP Socket (`connect()`) 建立 TLS / STARTTLS 连接发送认证邮件

## 3. 明确不包含的内容 (Out of Scope for V1)
- MFA / 2FA
- Passkey / WebAuthn
- 多租户组织 (Organizations / Teams)
- 复杂 RBAC 权限体系
- Billing / 计费
- 企业级 SSO (SAML 等)
- 动态客户端注册 (Dynamic Client Registration)
- 第三方社交登录 (Google/GitHub 快捷登录，留作后续拓展)
- 多个 Email 服务商 (V1 仅 Gmail SMTP)
