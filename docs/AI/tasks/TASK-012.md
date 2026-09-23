# TASK-012: 全流程端到端集成测试与生产部署规范

## Objective
构建全链路端到端集成测试套件，验证第三方应用接入 easy-oauth-worker 的真实流程（用户注册 -> 登录 -> 授权跳转 -> 换取 Token -> 校验 ID Token -> 获取 UserInfo），并提供完整的部署说明、数据库初始化种子脚本和 README 文档。

## Scope
- `test/e2e.test.ts`: 模拟真实第三方应用的 OAuth 2.0 PKCE + OIDC 完整授权登录全流程测试
- `scripts/seed.sql`: 初始测试用户与测试客户端 D1 种子数据
- `README.md`: 详尽的自托管部署教程（包含 Cloudflare Workers 部署、D1 绑定、Gmail 应用密码设置、环境变量配置）

## Allowed Files
- `test/e2e.test.ts`
- `scripts/seed.sql`
- `README.md`

## Dependencies
- TASK-009, TASK-011, TASK-006

## Acceptance Criteria
1. E2E 测试全绿通过，覆盖完整的 OAuth PKCE + OIDC 换取 Token 和 UserInfo 全流程。
2. 包含清晰可执行的本地运行、迁移与一键部署命令。
3. 文档详实，包含 Gmail SMTP 应用密码配置引导与生产部署注意事项。

## Verification Commands
```bash
pnpm run test
pnpm run typecheck
```

## Status
DONE

## Completed Deliverables
- `test/e2e.test.ts`: 全链路端到端集成测试，覆盖从用户注册、登录、OAuth 2.0 PKCE 授权与 Consent 确认、换取 Token（Access Token, Refresh Token, RS256 ID Token）、JWKS 公钥签名校验、UserInfo 接口读取、Token 刷新与 Token 撤销（Revoke）的全部 8 个真实交互阶段。
- `scripts/seed.sql`: 初始 D1 种子数据脚本，预置默认管理员 (`admin@example.com` / `AdminPassword123!`)、机密客户端应用 (`web-app-client`) 与公开 SPA 应用 (`spa-client`)。
- `README.md`: 完整的项目生产部署与快速上手文档，包含架构设计、本地开发、D1 迁移、Gmail SMTP 应用专用密码配置指引、Wrangler 生产部署指南与 NextAuth / OIDC 客户端接入示例代码。

