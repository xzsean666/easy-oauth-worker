# TASK-007: OAuth 2.0 客户端管理与授权码服务

## Objective
实现 OAuth 2.0 授权服务器核心逻辑，包括客户端信息校验、严格的 redirect_uri 匹配、PKCE code_challenge 绑定与 code_verifier 校验、单次有效授权码下发与消费、Access Token 和 Refresh Token 的生命周期管理。

## Scope
- `src/services/oauth.service.ts`: 授权码生成与核销、令牌交换、令牌撤销逻辑
- `test/oauth.service.test.ts`: OAuth 业务逻辑与安全规则单元测试

## Allowed Files
- `src/services/oauth.service.ts`
- `test/oauth.service.test.ts`

## Dependencies
- TASK-002, TASK-003, TASK-004

## Acceptance Criteria
1. 严格白名单校验 `redirect_uri`。
2. 强制校验 PKCE `code_verifier` 与 `code_challenge`（S256 算法）。
3. 授权码单次消费后失效，重放攻击立即拒绝。
4. 单元测试覆盖各类非法请求（URI 不匹配、PKCE 错误、过期的授权码）。

## Verification Commands
```bash
pnpm run test test/oauth.service.test.ts
```

## Status
DONE
