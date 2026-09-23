# TASK-002: 数据库设计与 D1 迁移管理

## Objective
设计并落地 Cloudflare D1 (SQLite) 数据库表结构，编写 SQL 迁移脚本，定义 TypeScript 数据库实体类型，并编写本地 SQLite 内存测试以验证表结构建立与 CRUD 基本查询正常。

## Scope
- 编写 SQL 迁移文件 `migrations/0001_initial_schema.sql`，涵盖用户表 `users`、会话表 `sessions`、OAuth 客户端表 `oauth_clients`、授权码表 `oauth_authorization_codes`、Token 表 `oauth_tokens`、临时凭证表 `verification_tokens`。
- 编写数据库类型定义 `src/db/schema.ts`。
- 编写 D1 访问帮助模块 `src/db/client.ts`。
- 编写迁移和 Schema 验证测试 `test/db.test.ts`。

## Allowed Files
- `migrations/0001_initial_schema.sql`
- `src/db/schema.ts`
- `src/db/client.ts`
- `test/db.test.ts`

## Dependencies
- TASK-001

## Inputs and Outputs
- **Inputs**: TASK-001 完成的基础工程环境。
- **Outputs**: 可直接用于 Cloudflare D1 部署的迁移 SQL 文件，强类型的表映射，通过测试的 D1 辅助函数。

## Acceptance Criteria
1. SQL 迁移脚本包含所有 V1 所需数据表、主键与索引。
2. 单元测试验证表创建成功、索引正常生效、基础外键约束与数据读写正常。
3. `pnpm run typecheck` 和 `pnpm run test` 通过。

## Verification Commands
```bash
pnpm run typecheck
pnpm run test
```

## Risks and Assumptions
- SQLite 与 D1 的语法兼容性（采用标准 SQLite DDL）。

## Status
DONE
