# TASK-011: 管理控制台 Web UI 界面

## Objective
使用 Hono JSX + Tailwind CSS 构建易用、美观、响应式的管理控制台 Web 页面，涵盖 `/admin` 仪表盘、`/admin/users` 用户管理面板、`/admin/clients` OAuth 客户端管理面板以及基础系统设置面板。

## Scope
- `src/views/admin/layout.tsx`: 管理后台侧边栏与头部通用布局
- `src/views/admin/dashboard.tsx`: 仪表盘概览卡片与数据统计
- `src/views/admin/users.tsx`: 用户列表、搜索、状态操作与会话吊销
- `src/views/admin/clients.tsx`: 客户端列表、新建客户端弹窗/页面、Secret 轮换
- `src/views/admin/settings.tsx`: 系统配置（站点名称、Issuer、SMTP状态）展示
- `src/routes/admin-web.ts`: 管理后台页面路由
- `test/admin.web.test.ts`: 管理页面渲染测试

## Allowed Files
- `src/views/admin/layout.tsx`
- `src/views/admin/dashboard.tsx`
- `src/views/admin/users.tsx`
- `src/views/admin/clients.tsx`
- `src/views/admin/settings.tsx`
- `src/routes/admin-web.ts`
- `test/admin.web.test.ts`

## Dependencies
- TASK-010, TASK-005

## Acceptance Criteria
1. 后台页面排版现代且自适应移动端与桌面端。
2. 支持直观地查看与禁用用户、手动验证邮箱、吊销用户 Session。
3. 支持查看客户端并安全地轮换 Client Secret（仅展示一次生成后的新 Secret）。

## Verification Commands
```bash
pnpm run test test/admin.web.test.ts
```

## Status
DONE
