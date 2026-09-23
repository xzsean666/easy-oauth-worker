# TASK-013: OIDC 协议符合性与基础认证安全修复

## 状态
- 状态: DONE
- 负责人: AI Agent
- 依赖: TASK-012

## 任务目标
1. 修复 OIDC `nonce` 传递与持久化丢失问题，使得 ID Token 严格符合 OpenID Connect Core 1.0 规范，保障标准 OIDC 客户端（NextAuth 等）接入顺畅。
2. 修复 `/login` 与 `/register` 的开放重定向漏洞（Open Redirect），防范钓鱼攻击。
3. 规范 `/oauth/token` 端点响应头，强制设置 `Cache-Control: no-store` 与 `Pragma: no-cache`。
4. 修复 ID Token 中 `auth_time` 的语义，使其反映真实认证/授权时间。

## 允许修改的文件
- `migrations/0001_initial_schema.sql`
- `src/db/schema.ts`
- `src/services/oauth.service.ts`
- `src/services/oidc.service.ts`
- `src/routes/oauth.ts`
- `src/routes/auth.ts`
- `test/oidc.service.test.ts`
- `test/oauth.routes.test.ts`
- `test/auth.routes.test.ts`
- `test/e2e.test.ts`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## 验收标准
1. `oauth_authorization_codes` 表支持存储 `nonce` 字段。
2. 当 `/oauth/authorize` 与 `/oauth/consent` 携带 `nonce` 时，授权码兑换的 ID Token 包含正确的 `nonce` Claim。
3. `/login` 和 `/register` 的 `return_to` 只能重定向至合法的站内相对路径，外部 URL（如 `https://evil.com`、`//evil.com`）会被重置为 `/`。
4. `/oauth/token` 的成功与错误响应均包含 `Cache-Control: no-store` 和 `Pragma: no-cache`。
5. ID Token 的 `auth_time` 字段反映当前认证或会话时间戳。
6. 全量类型检查 `pnpm run typecheck` 0 错误，全量测试套件通过且新增/更新测试用例。
