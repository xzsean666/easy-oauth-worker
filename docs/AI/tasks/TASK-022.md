# TASK-022: Cloudflare Pages D1 持久化绑定全自动打通与凭证引导

## 1. 任务说明
- **任务编号**: TASK-022
- **任务名称**: Cloudflare Pages D1 持久化绑定全自动打通与凭证引导 (Automated Pages D1 Binding & Persistence Pipeline)
- **依赖任务**: TASK-021
- **主要目标**:
  用户强烈要求自动化完成 D1 数据库持久化读写的全套准备（创建、迁移、种子注入及 Pages 绑定），杜绝手动控制台操作：
  1. **Pages 专用 D1 自动绑定流水线**:
     在 `scripts/deploy-pages.sh` 执行 Pages 部署时，利用 Pages 对 `wrangler.toml` 的原生绑定支持，动态切换出兼容 Pages 的部署配置（包含 `[[d1_databases]] binding = "DB"`、`pages_build_output_dir = "public"` 及 `[vars]`，剔除 Worker 的 `main` 与 `triggers`），部署后安全还原，让 Cloudflare Pages 自动绑定 D1 数据库，零控制台手动操作。
  2. **D1 数据库自动解析、创建与回填**:
     - 支持读取真实 `database_id`，或支持命令行 `--db-id <UUID>` 传入。
     - 若未配置且处于占位符状态，自动通过 `npx wrangler d1 create "$DB_NAME"` 创建远程 D1 数据库，并正则提取真实 UUID 自动写回 `wrangler.toml`。
     - 自动执行 `npx wrangler d1 migrations apply "$DB_NAME" --remote` 与 `seed.sql` 初始数据灌入。
  3. **API Token 权限诊断与容错引导**:
     若当前环境的 `CLOUDFLARE_API_TOKEN` 缺少 `Account -> D1 -> Edit` 权限（Cloudflare API 10000 报错），输出清晰友好的诊断说明与权限开启指导，同时支持传入已有 D1 UUID 继续完成 Pages 自动绑定。
  4. **全套自动化测试保护**:
     更新 `test/pages-deploy.test.ts` 断言新增的 `--db-id` 选项与 Pages 动态绑定机制。

## 2. 影响文件
- `docs/AI/tasks/TASK-022.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `scripts/deploy-pages.sh` (更新)
- `README.md` (更新)
- `test/pages-deploy.test.ts` (更新)

## 3. 验收标准
1. `scripts/deploy-pages.sh` 具备 Pages 动态 D1 绑定能力，支持 `--db-id` 参数。
2. 部署时自动将 D1 绑定（`DB`）带入 Pages 发布，退出码为 0。
3. `pnpm test test/pages-deploy.test.ts` 测试通过。
4. `pnpm run typecheck` 0 错误。
5. `pnpm run test` 全量测试套件 100% 通过。

## 4. 验证命令
```bash
bash scripts/deploy-pages.sh --help
pnpm test test/pages-deploy.test.ts
pnpm run typecheck
pnpm run test
```

## 5. 状态
DONE

## 6. 完成交付成果
- `scripts/deploy-pages.sh`:
  - 增加 `--db-id <UUID>` 参数与自动检测提取逻辑，支持从 `wrangler.toml` 识别已有 UUID；
  - 自动创建 D1、自动提取 UUID 回填配置文件、自动执行表迁移与 Seed 初始数据灌入；
  - 部署阶段动态生成 Pages 专用的 `wrangler.toml`，自动将 `[[d1_databases]] binding = "DB"` 注入部署中，实现 Pages 自动化绑定 D1 持久化数据库，部署后通过 trap 自动复原文件；
  - API Token 缺少 D1 权限时精准输出二选一指引。
- `test/pages-deploy.test.ts`: 更新测试套件断言保护 `--db-id` 参数与部署规范。
- `README.md`: 补充自动化 D1 绑定机制说明与 `--db-id` 命令行参数。
