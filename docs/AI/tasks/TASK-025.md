# TASK-025: 彻底移除邮箱相关字段与重置合并纯净数据库迁移

## 1. 任务说明
- **任务编号**: TASK-025
- **任务名称**: 彻底移除邮箱相关字段与重置合并纯净数据库迁移 (Purge Email Fields & Consolidate Clean No-Email Database Schema)
- **依赖任务**: TASK-024
- **主要目标**:
  根据用户最新明确要求（“migrations 清理一下，不需要向前兼容，完全没有邮箱字段”），彻底完成纯用户名架构的净化：
  1. **清理重置 Migrations 目录**:
     - 删除增量迁移 `migrations/0002_add_totp_and_username.sql`；
     - 重写 `migrations/0001_initial_schema.sql`，作为唯一初始 Schema，彻底移除 `email` 和 `email_verified` 字段，以 `username TEXT UNIQUE NOT NULL` 为主标识，内建 TOTP 字段；
  2. **全面清理代码中遗留的邮箱字段与死代码**:
     - `src/db/schema.ts`: `User` 接口彻底剔除 `email` 和 `email_verified`；
     - `src/services/auth.service.ts`: 移除邮箱格式校验与旧邮箱验证/找回函数，全面简化为纯用户名注册/登录/找回；
     - `src/views/` 与 `src/routes/auth.ts`: 移除邮箱输入框、移除 `/verify-email` 与 `/reset-password` 遗留路由；
     - `src/services/admin.service.ts` & `src/views/admin/`: 移除邮箱验证列与动作，以 username 呈现；
     - `src/services/oidc.service.ts` & `src/routes/oauth.ts`: 使用 `username` / `preferred_username` 提供主体标识；
  3. **测试套件全面重构与验证**:
     - 重构所有原有测试用例中以 email 注册登录的代码，统一为规范的纯用户名；
     - 确保全量测试套件 100% 通过，TypeScript 类型检查 0 错误。

## 2. 影响文件
- `docs/AI/tasks/TASK-025.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `migrations/0001_initial_schema.sql` (重写)
- `migrations/0002_add_totp_and_username.sql` (删除)
- `src/db/schema.ts` (更新)
- `src/types/env.ts` (更新)
- `src/services/auth.service.ts` (重构精简)
- `src/services/admin.service.ts` (更新)
- `src/services/oidc.service.ts` (更新)
- `src/routes/auth.ts` (更新)
- `src/routes/oauth.ts` (更新)
- `src/routes/admin-api.ts` (更新)
- `src/routes/admin-web.tsx` (更新)
- `src/views/auth/login.tsx` (更新)
- `src/views/auth/register.tsx` (更新)
- `src/views/auth/forgot-password.tsx` (更新)
- `src/views/oauth/consent.tsx` (更新)
- `src/views/admin/users.tsx` (更新)
- `src/views/admin/dashboard.tsx` (更新)
- 相关测试文件 (更新适配纯用户名)

## 3. 验收标准
1. `migrations/` 目录下仅有单一且纯净的 `0001_initial_schema.sql`，表结构中完全无 `email` 与 `email_verified` 字段。
2. `src/db/schema.ts` 的 `User` 接口完全无 `email` 字段。
3. 注册、登录、个人安全中心、TOTP 找回密码全流程均只使用用户名，不出现任何邮箱输入或字段。
4. `pnpm run typecheck` 0 错误。
5. `pnpm run test` 全量测试 100% 通过。

## 4. 验证命令
```bash
pnpm run typecheck
pnpm run test
```

## 5. 状态
DONE

## 6. 完成记录
- `migrations/` 已精简合并为单一纯净的 `0001_initial_schema.sql`，无任何 email 字段与向前兼容负担；
- 全库 `src/` 与 `test/` 源码完全净化，零 `email` 残留，主体标识全量统一为 `username`；
- 全部 16 个测试套件（136 个测试用例）100% 成功通过；
- `pnpm run typecheck` 0 错误；
- 文档与种子数据全面完成同步。
