# TASK-009: OAuth 流程集成与 Consent 授权确认页

## Objective
提供完整的 OAuth 2.0 / OIDC 外部协议端点与用户交互界面，打通从 `/oauth/authorize` 发起、检查用户登录态、显示 `/oauth/consent` 授权确认界面、重定向回第三方应用，到 `/oauth/token` 兑换令牌、`/oauth/userinfo` 获取身份以及 `/oauth/revoke` 撤销令牌的完整 HTTP 路由。

## Scope
- `src/views/oauth/consent.tsx`: 授权确认页面（展示请求的应用名称与 Scopes 权限列表）
- `src/routes/oauth.ts`: `/oauth/authorize`, `/oauth/consent`, `/oauth/token`, `/oauth/revoke` 路由
- `src/routes/oidc.ts`: `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/oauth/userinfo` 路由
- `test/oauth.routes.test.ts`: 端点交互集成测试

## Allowed Files
- `src/views/oauth/consent.tsx`
- `src/routes/oauth.ts`
- `src/routes/oidc.ts`
- `test/oauth.routes.test.ts`

## Dependencies
- TASK-007, TASK-008, TASK-005

## Acceptance Criteria
1. 未登录用户访问 `/oauth/authorize` 自动暂存上下文并引导至登录页。
2. 登录后正确引导至 Consent 授权页。
3. 同意授权后安全重定向并携带 code 与 state。
4. Token 端点正常完成 code 交换并返回 Access Token 与 ID Token。

## Verification Commands
```bash
pnpm run test test/oauth.routes.test.ts
```

## Status
DONE
