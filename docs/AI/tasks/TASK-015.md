# TASK-015: 邮件服务全链路业务闭环与开发模式增强

## 状态
- 状态: DONE
- 负责人: AI Agent
- 依赖: TASK-014

## 任务目标
1. 在 `POST /register` 中真实调用 `sendEmail` 发送邮箱验证邮件；若未配置 SMTP 凭据，在开发/测试日志中输出验证链接，不抛出异常阻断用户。
2. 在 `POST /forgot-password` 中真实调用 `sendEmail` 发送密码重置邮件；若未配置 SMTP 凭据，在开发/测试日志中输出重置链接。
3. 完善邮件发送服务异常捕获与 Socket 超时保护。

## 允许修改的文件
- `src/routes/auth.ts`
- `src/services/email.service.ts`
- `test/auth.routes.test.ts`
- `test/email.service.test.ts`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## 验收标准
1. 用户注册与找回密码成功触发邮件发送逻辑。
2. 开发模式或未设置 SMTP 凭据时，能优雅降级输出链接并正常返回成功页面。
3. 全量类型检查与测试通过。
