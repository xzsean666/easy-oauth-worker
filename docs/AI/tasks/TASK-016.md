# TASK-016: 跨域支持、安全响应头与定时数据清理

## 状态
- 状态: DONE
- 负责人: AI Agent
- 依赖: TASK-015

## 任务目标
1. 挂载 CORS 中间件，对公开端点（`/.well-known/*`、`/oauth/token`、`/oauth/userinfo`、`/oauth/revoke`）开放跨域请求（支持 OPTIONS 预检）。
2. 注入全局安全响应头（`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`）。
3. 配置定时清理任务（Cron Trigger），自动清理过期会话、废弃授权码、过期验证 Token 及已撤销的 OAuth 凭据。
4. 添加全局错误捕获中间件（`app.onError`）与 404 处理。

## 允许修改的文件
- `src/index.ts`
- `wrangler.toml`
- `test/health.test.ts`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## 验收标准
1. SPA 跨域请求公开端点携带正确的 CORS 响应头，OPTIONS 预检正常返回。
2. 页面与 API 带有基础安全头，防范 Clickjacking。
3. 暴露定时清理逻辑（Scheduled Handler），定期清理废弃数据。
4. 全量类型检查与测试通过。
