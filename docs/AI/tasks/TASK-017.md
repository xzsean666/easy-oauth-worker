# TASK-017: 全方位安全性、生产就绪度与性能加固优化

## 1. 任务说明
- **任务编号**: TASK-017
- **任务名称**: 全方位安全性、生产就绪度与性能加固优化 (Comprehensive Security, Production Readiness & Performance Optimization)
- **依赖任务**: TASK-016
- **主要目标**:
  根据项目全量深度审计报告，治理所有已识别的潜在安全与生产隐患，同时严格兼顾性能（避免额外 DB 往返与 CPU 开销）：
  1. **数据清理修复**: 修正 `cleanupExpiredData`，彻底解决自然过期与失效 Token 遗留膨胀问题。
  2. **CSRF 防护**: 基于 WebCrypto HMAC-SHA256 实现零数据库开销的 Session-Bound CSRF 防护，覆盖 Consent 授权及管理控制台状态变更表单。
  3. **凭据安全**: 消除管理端新建及轮换 Client Secret 时通过 GET URL Query 明文传递的问题，采用短期安全 Flash Cookie 机制。
  4. **DoS 与暴力破解防御**: 限制密码最大长度（128字符）杜绝 PBKDF2 CPU 耗尽攻击；实现轻量级内存频控中间件（Rate Limiting）。
  5. **管理台自锁死与 SMTP 指令注入防护**: 禁止管理员降权/禁用自身账号；在 SMTP 传输前严格校验 CRLF 字符。
  6. **OIDC 私钥持久化保障**: 优化 `getSigningKey` 生产缺失预警，并提供一键生成生产 RSA 密钥对的脚本工具。

## 2. 影响文件
- `src/index.ts`
- `src/crypto/csrf.ts` (新建)
- `src/services/admin.service.ts`
- `src/services/auth.service.ts`
- `src/services/email.service.ts`
- `src/services/oidc.service.ts`
- `src/middlewares/rate-limit.ts` (新建)
- `src/routes/admin-web.tsx`
- `src/routes/admin-api.ts`
- `src/routes/oauth.ts`
- `src/views/oauth/consent.tsx`
- `src/views/admin/clients.tsx`
- `src/views/admin/users.tsx`
- `scripts/generate-keys.ts` (新建)
- `test/security.test.ts` (新建)
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## 3. 验收标准
1. `cleanupExpiredData` 能够正确清理自然过期和超期 Refresh Token。
2. 管理后台敏感操作和 OAuth Consent 提交强制验证 CSRF Token，缺少或篡改的请求被拦截。
3. 创建 Client 和轮换 Secret 时，URL 不包含 `new_secret`，使用 Flash Cookie 一次性呈现后自动销毁。
4. 密码输入长度限制为 8~128 字符，防止超长字符引发 DoS。
5. 管理员不可禁用自身或移除自身管理员角色。
6. SMTP 发信前拦截带 CRLF 换行的非法邮箱地址。
7. 未配置 `OIDC_SIGNING_KEY` 时控制台输出明确生产警告，并提供一键生成工具。
8. 全部 108+ 自动化测试通过，且新增的安全性测试全部绿灯通过。
