# TASK-008: OpenID Connect 核心协议实现

## Objective
在 OAuth 2.0 基础之上实现 OpenID Connect (OIDC) 扩展，包括 Discovery 配置元数据输出、JWKS 公钥暴露、符合 OIDC 规范的 ID Token (JWT) 签发与 Claims 注入（sub, email, email_verified 等），以及 `/oauth/userinfo` 端点服务。

## Scope
- `src/services/oidc.service.ts`: OIDC Discovery 元数据构造、UserInfo 数据拼装、ID Token 组装与签名
- `test/oidc.service.test.ts`: OIDC 规范遵从度与签名验证测试

## Allowed Files
- `src/services/oidc.service.ts`
- `test/oidc.service.test.ts`

## Dependencies
- TASK-003, TASK-007

## Acceptance Criteria
1. OIDC Discovery 返回完整的协议配置声明。
2. JWKS 返回标准公钥数据。
3. ID Token 包含正确的 `iss`, `sub`, `aud`, `exp`, `iat` 和请求的 scopes 对应 Claims。
4. 单元测试全部通过。

## Verification Commands
```bash
pnpm run test test/oidc.service.test.ts
```

## Status
DONE
