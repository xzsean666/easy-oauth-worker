# TASK-004: 用户认证核心业务与会话管理

## Objective
实现用户体系的核心业务逻辑（Service 层），包括用户邮箱注册、密码校验登录、邮箱验证令牌生成与核销、找回与重置密码、修改密码，以及 Session 的持久化、验证与撤销。

## Scope
- `src/services/auth.service.ts`: 注册、密码登录、邮箱验证、重置密码逻辑
- `src/services/session.service.ts`: 会话创建、根据 Session ID 检索用户信息、单会话与全量会话注销
- `test/auth.service.test.ts`: 认证业务与会话服务的测试覆盖

## Allowed Files
- `src/services/auth.service.ts`
- `src/services/session.service.ts`
- `test/auth.service.test.ts`

## Dependencies
- TASK-002, TASK-003

## Acceptance Criteria
1. 支持完整的注册 -> 发送验证令牌 -> 激活账户流程。
2. 支持密码登录 -> 返回 Session -> 验证有效性的完整闭环。
3. 支持 Revoke Session 使得已登录用户立即失效。
4. 单元测试覆盖正常流与异常流（密码错误、用户禁用、令牌过期等）。

## Verification Commands
```bash
pnpm run test test/auth.service.test.ts
```

## Status
DONE
