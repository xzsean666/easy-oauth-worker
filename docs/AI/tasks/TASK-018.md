# TASK-018: Cloudflare Pages 部署适配与自动化部署脚本

## 1. 任务说明
- **任务编号**: TASK-018
- **任务名称**: Cloudflare Pages 部署适配与自动化部署脚本 (Cloudflare Pages Deployment Adaptation & Automation Script)
- **依赖任务**: TASK-017, TASK-ENV-SMTP
- **主要目标**:
  为 `easy-oauth-worker` 提供完整的 Cloudflare Pages 全栈部署支持，实现一键从本地代码库部署至 Cloudflare Pages：
  1. **Pages Functions 适配**: 提供基于 `hono/cloudflare-pages` 的 `functions/[[path]].ts` 路由桥接。
  2. **静态资产目录**: 提供 `public/` 目录，包含 `robots.txt`、`favicon.svg` 及 `_headers`。
  3. **自动化部署脚本**: 编写健壮、带自检与多环境参数支持的 `scripts/deploy-pages.sh`。
  4. **快捷指令与文档**: 在 `package.json` 中配置 `deploy:pages` / `pages:dev`，并在 `README.md` 中增加 Pages 部署指南。
  5. **自动化测试**: 编写 `test/pages-deploy.test.ts` 确保部署脚本与 Pages 文件规范持续受保护。

## 2. 影响文件
- `docs/AI/tasks/TASK-018.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `functions/[[path]].ts` (新建)
- `public/robots.txt` (新建)
- `public/favicon.svg` (新建)
- `public/_headers` (新建)
- `scripts/deploy-pages.sh` (新建)
- `package.json` (更新)
- `tsconfig.json` (更新)
- `README.md` (更新)
- `test/pages-deploy.test.ts` (新建)

## 3. 验收标准
## 4. 验证命令
```bash
bash scripts/deploy-pages.sh --help
pnpm run typecheck
pnpm run test
```

## 5. 状态
DONE

## 6. 完成交付成果
- `functions/[[path]].ts`: Cloudflare Pages Functions 入口，通过 `hono/cloudflare-pages` 将 HTTP 请求路由到 Hono 应用。
- `public/`: 包含 `robots.txt`、`favicon.svg`、`_headers`（Pages 响应头规则）。
- `scripts/deploy-pages.sh`: 生产级全自动部署 Shell 脚本，集成依赖检查、代码自检、D1 远程迁移/种子注入、Pages 项目初始化、Secrets 同步和部署。
- `package.json`: 注册 `deploy:pages` 和 `pages:dev` 快捷脚本。
- `test/pages-deploy.test.ts`: 针对 Pages 部署关键配置与脚本规范的自动化测试套件。
- `README.md`: 详尽的 Cloudflare Pages 部署教程与命令行参数说明。
