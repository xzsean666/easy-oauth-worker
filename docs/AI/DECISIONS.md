# Architecture Decisions: easy-oauth-worker

## ADR-001: 技术栈选型为 Hono + TypeScript + D1
- **背景**: 项目需运行在 Cloudflare Workers 边缘计算环境上，具备极小启动延迟和标准 Web API 兼容性。
- **决定**: 采用 TypeScript 作为主力开发语言，Hono 作为 Web 框架，Cloudflare D1 作为后端关系型 SQLite 数据库。
- **原因**: Hono 专为 Workers 设计，生态成熟且类型安全，天然支持 JSX 服务端渲染，无需打包复杂的前端客户端 SPA。

## ADR-002: 密码学与 JWT 签名采用原生 Web Crypto API
- **背景**: 外部加密库（如 node:crypto 或 bcrypt）在 Cloudflare Workers 环境下往往体积巨大或缺乏原生二进制模块支持。
- **决定**: 密码哈希使用 PBKDF2-SHA256（结合 100,000 轮迭代与 16 字节随机盐）；Token 签名使用 RS256/WebCrypto。
- **原因**: Web Crypto 是 W3C 标准和 Cloudflare Workers 内置的原生能力，运行速度快、内存开销极低、无额外 npm 庞大依赖。

## ADR-003: 强制采用 PKCE (S256)
- **背景**: 传统 OAuth 2.0 依赖 Client Secret 进行验证，但现代 SPA 和 Native 客户端无法安全保管 Secret。OAuth 2.1 规范要求强制 PKCE。
- **决定**: easy-oauth-worker 第一版授权码流程默认强制实施 PKCE（`code_challenge_method=S256`）。
- **原因**: 彻底杜绝授权码拦截攻击，并对公开客户端和机密客户端提供统一的安全标准。

## ADR-004: UI 渲染架构采用 Hono JSX 服务端直出 + Tailwind CSS
- **背景**: easy-oauth-worker 定位为纯粹的身份认证与授权网关，用户交互集中在登录、注册、授权确认和简易管理界面。
- **决定**: 采用 Hono JSX 在 Worker 端直接返回 HTML，引入轻量 Tailwind CSS CDN 样式。
- **原因**: 彻底消除客户端 JS 打包和加载开销，首屏秒开，易于维护与定制，安全攻击面极小。

## ADR-005: 邮件服务采用 Workers Outbound TCP Sockets 直连 Gmail SMTP
- **背景**: 邮件通知只支持 Gmail SMTP，且需在 Workers 无服务器环境下发送。
- **决定**: 使用 `cloudflare:sockets` 建立直接的 TLS/STARTTLS TCP 连接，实现 SMTP 握手、身份认证与邮件投递。
- **原因**: 满足第一版只支持 Gmail SMTP 的明确要求，避开端口 25 限制，使用 465 (TLS) 或 587 (STARTTLS)。
