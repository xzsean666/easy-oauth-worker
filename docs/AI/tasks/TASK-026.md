# TASK-026: Cloudflare Pages 部署脚本针对新数据库架构与纯用户名模型的深度适配与重置优化

## 1. 任务说明
- **任务编号**: TASK-026
- **任务名称**: Cloudflare Pages 部署脚本针对新数据库架构与纯用户名模型的深度适配与重置优化 (Optimize deploy-pages.sh for No-Email Schema & Add Database Reset Support)
- **依赖任务**: TASK-025
- **主要目标**:
  根据用户反馈与数据库 Schema 重大变更（完全剔除邮箱、合并单一初始迁移、不向前兼容），优化 `scripts/deploy-pages.sh`：
  1. **支持一键重置与应用纯净 Schema (`--reset-db`)**:
     - 解决旧 D1 数据库因 `d1_migrations` 记录导致跳过重写后的 `0001_initial_schema.sql` 的问题；
     - 允许在打破向前兼容时，一键清空旧表结构并全新构建纯用户名 + TOTP 表；
  2. **智能检测远端 Schema 结构**:
     - 探测远端 D1 中 `users` 表结构，识别是否存在旧版 `email` 字段或缺少 `username` 字段，给出精准诊断指导；
  3. **清理废弃的 SMTP 变量与密钥同步**:
     - 移除 Pages 临时 `wrangler.toml` 中的 `SMTP_HOST`、`SMTP_PORT`、`SMTP_FROM`；
     - 移除密钥上传中对 `SMTP_PASSWORD` 与 `SMTP_USERNAME` 的无效尝试；
  4. **完善部署测试与文档**:
     - 更新 `test/pages-deploy.test.ts` 与 `README.md`。

## 2. 影响文件
- `scripts/deploy-pages.sh` (重构与增强)
- `test/pages-deploy.test.ts` (增加 --reset-db 校验)
- `docs/AI/tasks/TASK-026.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `README.md` (更新部署选项说明)

## 3. 验收标准
1. `bash scripts/deploy-pages.sh --help` 正常展示 `--reset-db` 参数；
2. 脚本中 0 处 `SMTP` 残留；
3. `pnpm test test/pages-deploy.test.ts` 通过；
4. `pnpm run typecheck && pnpm test` 全量通过。

## 4. 验证命令
```bash
bash scripts/deploy-pages.sh --help
pnpm test test/pages-deploy.test.ts
pnpm run typecheck
pnpm test
```

## 5. 状态
DONE

## 6. 完成记录
- 为 `scripts/deploy-pages.sh` 增加了 `--reset-db` 参数与远端 D1 数据库重置重建逻辑（删除旧表并重新应用纯净的 `0001_initial_schema.sql`）；
- 增加了针对远端 `users` 表结构的探测与诊断（`PRAGMA table_info`），检测出旧邮箱 Schema 时主动告警并提供一键重置引导；
- 彻底清除了部署脚本中所有残留的 SMTP 环境变量与密钥上传（`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_PASSWORD`, `SMTP_USERNAME`）；
- 更新了 `test/pages-deploy.test.ts` 并在全量测试套件（16 passed, 136 passed）与 TypeScript 类型检查中 100% 通过验证。
