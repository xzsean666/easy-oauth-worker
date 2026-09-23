# TASK-023: 默认启用极速部署模式与按需深度校验支持

## 1. 任务说明
- **任务编号**: TASK-023
- **任务名称**: 默认启用极速部署模式与按需深度校验支持 (Default Fast Deploy Mode & On-Demand Deep Verification)
- **依赖任务**: TASK-022
- **主要目标**:
  根据用户反馈调整默认行为，实现“开箱即极速”，任何时候直接运行 `scripts/deploy-pages.sh` 或 `pnpm run deploy:pages` 均采用 Fast 模式完成秒级发布：
  1. **默认极速部署 (Default Fast Mode)**: 默认不带参数时跳过耗时的测试套件与重复 D1 迁移探测，非交互直发 Pages，自动复用并绑定 `wrangler.toml` 中配置的有效 D1 数据库。
  2. **按需深度操作参数**:
     - `--test`: 显式触发 TypeScript 类型检查与 Vitest 测试套件；
     - `--migrate`: 显式触发远程 D1 数据库 Schema 迁移；
     - `--full`: 启用全流程完整自检（测试 + 迁移 + 部署）；
     - 保留向后兼容（`--fast`、`--skip-tests`、`--skip-migrate`、`--seed`、`--db-id` 等参数完全保留）。
  3. **测试保护与文档规范**:
     - 更新 `test/pages-deploy.test.ts` 保护新增选项与默认行为；
     - 更新 `README.md` 明确默认部署命令的秒级体验。

## 2. 影响文件
- `docs/AI/tasks/TASK-023.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `scripts/deploy-pages.sh` (更新)
- `README.md` (更新)
- `test/pages-deploy.test.ts` (更新)

## 3. 验收标准
1. 直接运行 `bash scripts/deploy-pages.sh` 默认不卡顿、不交互、不跑测试，数秒内发布上线并自动绑定 D1。
2. `bash scripts/deploy-pages.sh --help` 输出包含完整选项说明。
3. `pnpm test test/pages-deploy.test.ts` 测试通过。
4. `pnpm run typecheck` 0 错误。
5. `pnpm run test` 全量测试 100% 通过。

## 4. 验证命令
```bash
bash scripts/deploy-pages.sh --help
bash scripts/deploy-pages.sh
pnpm test test/pages-deploy.test.ts
pnpm run typecheck
pnpm run test
```

## 5. 状态
DONE

## 6. 完成交付成果
- `scripts/deploy-pages.sh`:
  - 将脚本默认运行模式调整为 **Fast 模式**（跳过冗余测试与重复迁移，非交互式直发 Pages）；
  - 自动复用并绑定 `wrangler.toml` 中配置的有效 D1 数据库 UUID（`8702c798-a252-452d-a8a6-6ad77ccdbc61`）；
  - 增加 `--test` / `-t`（按需跑测试）、`--migrate` / `-m`（按需跑 D1 迁移）、`--full`（全套自检交互）选项；
  - 完美保持所有原有参数（`--fast`, `--skip-tests`, `--skip-migrate`, `--seed`, `--db-id` 等）向后兼容；
- `README.md`: 更新使用文档，将 `pnpm run deploy:pages` 或 `bash scripts/deploy-pages.sh` 标注为默认秒级直发命令。
- `test/pages-deploy.test.ts`: 验证所有部署配置、脚本权限与参数断言 100% 通过。
