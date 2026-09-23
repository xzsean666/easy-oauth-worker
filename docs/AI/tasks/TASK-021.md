# TASK-021: Cloudflare Pages 部署脚本极速模式与容错体验优化

## 1. 任务说明
- **任务编号**: TASK-021
- **任务名称**: Cloudflare Pages 部署脚本极速模式与容错体验优化 (Pages Deploy Script Fast Mode & Fault Tolerance Optimization)
- **依赖任务**: TASK-018, TASK-019
- **主要目标**:
  解决用户直接执行 `scripts/deploy-pages.sh` 无法一键顺畅部署的痛点（如 D1 权限/占位符 ID 报错阻断、全量测试耗时、多次阻塞式询问等），打造秒级响应、容错健壮、零阻碍的部署体验：
  1. **智能容错与故障隔离**: 即使远程 D1 数据库不存在、未配置或 API Token 缺少 D1 权限，脚本仅输出友好警示并指导手动绑定，绝不通过 `set -e` 阻断核心 Pages 前端及 Functions 部署。
  2. **极速部署模式 (--fast)**: 提供 `--fast` / `-f` 参数，默认或一键跳过冗余测试与已就绪的 D1 探测，实现“敲下命令数秒内立即发布”。
  3. **Wrangler 配置兼容性**: 在 `wrangler.toml` 中增加 `pages_build_output_dir = "public"`，消除 Wrangler 针对 Pages 部署的配置告警。
  4. **快捷指令增强**: 在 `package.json` 中配置更灵活的部署指令，并在 `README.md` 中说明极速部署与排错要点。
  5. **测试保障**: 更新 `test/pages-deploy.test.ts`，确保参数兼容性与容错逻辑得到全面验证。

## 2. 影响文件
- `docs/AI/tasks/TASK-021.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `scripts/deploy-pages.sh` (更新)
- `wrangler.toml` (更新)
- `package.json` (更新)
- `README.md` (更新)
- `test/pages-deploy.test.ts` (更新)

## 3. 验收标准
1. `bash scripts/deploy-pages.sh --help` 输出包含 `--fast` 选项且向后兼容原有所有选项。
2. 即使在 D1 API 权限受限或 `database_id` 为占位符的情况下，运行部署也不会异常中断退出。
3. `pnpm run typecheck` 检查通过，0 错误。
4. `pnpm run test` 全量测试套件（包括 `test/pages-deploy.test.ts`）100% 通过。
5. Cloudflare Pages 线上部署验证成功。

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
- `scripts/deploy-pages.sh`: 增加 `--fast` / `-f` 极速发布模式，跳过耗时测试与 D1 探测，支持秒级代码发布；D1 迁移及种子注入失败改为友好警告与引导，绝不因权限或占位符 ID 阻断 Pages 部署；为部署命令增加 `--commit-dirty=true`。
- `package.json`: 注册 `deploy:fast` 指令（`bash scripts/deploy-pages.sh --fast`），实现一键秒级部署。
- `test/pages-deploy.test.ts`: 补充 `--fast` 命令行参数与 `deploy:fast` npm 脚本保护断言。
- `README.md`: 更新 Cloudflare Pages 部署说明，将 `deploy:fast` 推荐为日常快速发布首选用例。
