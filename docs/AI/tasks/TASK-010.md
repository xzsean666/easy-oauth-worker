# TASK-010: 管理控制台核心服务与 API

## Objective
实现 Admin Console 相关的核心管理业务逻辑与 API，支持系统管理员统计系统全局数据（用户量、Session量、客户端量）、检索与管理用户（锁定、解锁、手动验证、删除、会话吊销）、管理 OAuth Clients（创建、删除、修改、轮换 Client Secret）。

## Scope
- `src/services/admin.service.ts`: 统计指标聚合、用户管理逻辑、客户端生命周期管理
- `src/middlewares/admin-auth.ts`: 管理员权限校验中间件
- `src/routes/admin-api.ts`: 管理操作 REST API
- `test/admin.service.test.ts`: 管理服务单元测试

## Allowed Files
- `src/services/admin.service.ts`
- `src/middlewares/admin-auth.ts`
- `src/routes/admin-api.ts`
- `test/admin.service.test.ts`

## Dependencies
- TASK-002, TASK-004, TASK-007

## Acceptance Criteria
1. 非管理员用户或未登录状态访问管理 API 返回 401/403。
2. 管理员可正确获取统计总览。
3. 管理员可吊销特定用户的所有会话、更新状态、轮换 Client Secret。
4. 单元测试全部通过。

## Verification Commands
```bash
pnpm run test test/admin.service.test.ts
```

## Status
DONE
