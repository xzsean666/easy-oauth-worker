# TASK-014: OAuth 2.0 权限边界与凭据生命周期加固

## 状态
- 状态: DONE
- 负责人: AI Agent
- 依赖: TASK-013

## 任务目标
1. 强制校验客户端 `allowed_scopes`，禁止超出预设权限的 Scope 申请。
2. 修复 Refresh Token 刷新时的 Scope 提权（Scope Escalation）漏洞，仅允许缩小或保持 Scope。
3. 实施 Refresh Token 30 天过期时效校验（`REFRESH_TOKEN_DURATION_SECONDS`）。
4. 密码重置与修改密码时级联吊销用户的全部活跃 OAuth Tokens。
5. 遵循 RFC 6749 2.3.1 支持 HTTP Basic 客户端凭据的 `decodeURIComponent`。

## 允许修改的文件
- `src/services/oauth.service.ts`
- `src/services/auth.service.ts`
- `src/routes/oauth.ts`
- `test/oauth.service.test.ts`
- `test/oauth.routes.test.ts`
- `test/auth.service.test.ts`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## 验收标准
1. 客户端申请超出 `client.allowed_scopes` 的范围时，授权接口拦截并返回 `invalid_scope`。
2. Refresh Token 申请包含原授权未包含的 Scope 时被拒绝。
3. 超过 30 天的 Refresh Token 刷新时报错已过期。
4. 用户重置密码后，先前的 Access Token 与 Refresh Token 全部置为 `revoked = 1`。
5. 全量类型检查与测试通过。
