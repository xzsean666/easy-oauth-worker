# TASK-001: 项目基础骨架与开发测试配置

## Objective
初始化 `easy-oauth-worker` 项目的最小骨架结构，配置 TypeScript、Cloudflare Wrangler、Hono 框架、Vitest 测试套件，并提供一个可运行的基础健康检查端点及自动化单元测试，确保开发环境、类型检查和测试通道全部通畅。

## Scope
- 配置 `package.json`（依赖及脚本配置）
- 配置 `tsconfig.json`（标准 Workers TypeScript 配置）
- 配置 `wrangler.toml`（Cloudflare Worker 配置文件，声明 D1 绑定和基础环境变量）
- 配置 `vitest.config.ts`（自动化测试套件配置）
- 编写核心入口文件 `src/index.ts`（基础 Hono 应用与 `/health` 端点）
- 编写应用环境类型声明 `src/types/env.ts`
- 编写自动化单元测试 `test/health.test.ts`
- 不在此任务中涉及具体数据库表、认证逻辑、邮件或前端 UI

## Allowed Files
- `package.json`
- `tsconfig.json`
- `wrangler.toml`
- `vitest.config.ts`
- `src/index.ts`
- `src/types/env.ts`
- `test/health.test.ts`
- `.gitignore`

## Dependencies
- 无（首个任务）

## Inputs and Outputs
- **Inputs**: 空仓库环境，包含 Node.js、pnpm
- **Outputs**:
  - 具备完整依赖声明与构建测试脚本的项目
  - 可正常运行并通过类型检查的 Hono 实例
  - 返回状态 `{"status":"ok","timestamp":...}` 的 `/health` 端点
  - 成功运行并通过的自动化测试 `test/health.test.ts`

## Acceptance Criteria
1. `pnpm install` 顺利安装依赖无严重冲突。
2. 运行类型检查（`pnpm run typecheck`）结果退出码为 0，无任何 TypeScript 报错。
3. 运行自动化测试（`pnpm run test`）全部通过，覆盖 `/health` 健康检查端点。
4. `src/types/env.ts` 规范定义了 Worker 的 `Bindings` 与全局环境变量类型。

## Verification Commands
```bash
pnpm run typecheck
pnpm run test
```

## Risks and Assumptions
- 假设宿主机支持 Node.js (>=18) 与 pnpm。
- 依赖项选择稳定主流版本：`hono`、`wrangler`、`vitest`、`typescript`。

## Status
DONE
