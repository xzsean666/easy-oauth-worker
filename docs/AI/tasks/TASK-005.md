# TASK-005: 用户认证 Web UI 页面与表单路由

## Objective
利用 Hono JSX 搭配 Tailwind CSS 样式实现现代、响应式、体验友好的认证页面，并连接 HTTP 路由完成表单提交流程与 Session Cookie 的安全设置。

## Scope
- `src/views/layout.tsx`: 基础页面布局、Tailwind CDN 样式骨架与响应式容器
- `src/views/auth/`: 登录、注册、邮箱验证提示、找回密码与重置密码视图
- `src/routes/auth.ts`: 对应的 HTTP 路由处理（GET 渲染页面，POST 表单验证、调用 Auth Service、设置/清除 HttpOnly Cookie）
- `test/auth.routes.test.ts`: 路由与页面渲染测试

## Allowed Files
- `src/views/layout.tsx`
- `src/views/auth/login.tsx`
- `src/views/auth/register.tsx`
- `src/views/auth/forgot-password.tsx`
- `src/views/auth/reset-password.tsx`
- `src/views/auth/verify-email.tsx`
- `src/routes/auth.ts`
- `test/auth.routes.test.ts`

## Dependencies
- TASK-004

## Acceptance Criteria
1. 提供现代化外观的响应式认证页面。
2. 登录成功自动下发安全属性完善的 HttpOnly Cookie。
3. 登出清理 Cookie 并废弃会话。
4. 表单错误能友好展示在界面中。

## Verification Commands
```bash
pnpm run test test/auth.routes.test.ts
```

## Status
DONE
