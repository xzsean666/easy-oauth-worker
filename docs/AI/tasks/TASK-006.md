# TASK-006: Gmail SMTP 邮件发送服务

## Objective
在 Cloudflare Workers 环境下利用 TCP Sockets 实现直连 Gmail SMTP 发送邮件的能力，并提供邮箱验证邮件和密码重置邮件的模板。

## Scope
- `src/services/email.service.ts`: 封装 SMTP 客户端协议通信（TLS 465 端口或 STARTTLS 587 端口通信，EHLO、AUTH LOGIN、MAIL FROM、RCPT TO、DATA 流程）
- 邮件 HTML 模板渲染（验证邮箱链接、重置密码链接）
- `test/email.service.test.ts`: SMTP 协议帧与模板生成的单测

## Allowed Files
- `src/services/email.service.ts`
- `src/views/email/templates.ts`
- `test/email.service.test.ts`

## Dependencies
- TASK-001

## Acceptance Criteria
1. 实现对 Gmail SMTP 标准端口（465 SSL/TLS 或 587 STARTTLS）的协议交互封装。
2. 遇到邮件发送异常时具备清晰的错误捕获与日志记录。
3. 单元测试验证邮件报文拼接与协议状态机转换正常。

## Verification Commands
```bash
pnpm run test test/email.service.test.ts
```

## Status
DONE
