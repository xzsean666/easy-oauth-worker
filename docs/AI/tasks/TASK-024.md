# TASK-024: 无邮箱架构重构与基于 Google Authenticator (TOTP) 的二步验证及密码找回

## 1. 任务说明
- **任务编号**: TASK-024
- **任务名称**: 无邮箱架构重构与基于 Google Authenticator (TOTP) 的二步验证及密码找回 (No-Email Architecture with Optional TOTP 2FA & Authenticator-based Password Recovery)
- **依赖任务**: TASK-003, TASK-004, TASK-005, TASK-010, TASK-011, TASK-023
- **主要目标**:
  根据用户反馈与零成本离线安全要求，全面改造认证体系，彻底摆脱外部邮件（SMTP）与短信（SMS）依赖：
  1. **无邮箱与纯用户名支持 (No-Email & Username Authentication)**:
     - 增加 `username` 唯一登录标识，允许无需邮箱直接注册与登录；
     - `email` 字段转为选填，注册成功后立即可用，无需强制发送激活邮件阻断流程。
  2. **轻量级原生 TOTP 密码学实现 (Native Web Crypto TOTP RFC 6238)**:
     - 纯原生 Web Crypto API 实现 Base32 编码解码、HMAC-SHA1 哈希及动态截断算法，零外部 npm 库依赖；
     - 支持标准 `otpauth://totp/...` 规范，兼容 Google Authenticator、Microsoft Authenticator、1Password 等。
  3. **自主开关两步验证 (User-controlled 2FA Switch & Security Center)**:
     - 新增用户安全中心页面 `/account/security`，支持用户自主查看当前 2FA 状态；
     - 支持自主绑定并激活 Google 身份验证器（出具 Base32 密钥、otpauth 链接与动态验证码激活校验）；
     - 支持自主关闭两步验证（需校验登录密码防误操作）。
  4. **两步验证登录流程 (2FA Login Flow)**:
     - 用户开启 TOTP 后，登录校验密码成功后拦截进入 `/login/2fa`，完成 6 位动态口令校验后方可颁发正式 Session。
  5. **基于 TOTP 的找回密码与无邮箱说明 (Password Recovery via TOTP & Explicit Warning)**:
     - 在找回密码页明确显著说明：系统为无邮箱/短信安全设计，**若未绑定 Google 身份验证器，将无法自助找回密码，需联系管理员协助**；
     - 已绑定验证器的用户，可通过用户名 + 6 位动态口令直接重置密码；未绑定的用户明确友好拦截；
     - 管理员后台提供兜底重置保障。

## 2. 影响文件
- `docs/AI/tasks/TASK-024.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `migrations/0002_add_totp_and_username.sql` (新建)
- `src/db/schema.ts` (更新)
- `src/crypto/totp.ts` (新建)
- `src/services/auth.service.ts` (更新)
- `src/routes/auth.ts` (更新)
- `src/views/auth/login.tsx` (更新)
- `src/views/auth/register.tsx` (更新)
- `src/views/auth/forgot-password.tsx` (更新)
- `src/views/auth/login-2fa.tsx` (新建)
- `src/views/account/security.tsx` (新建)
- `test/totp.test.ts` (新建)
- `test/no-email-totp.test.ts` (新建)

## 3. 验收标准
1. 支持纯用户名注册与登录，无需填写邮箱即可正常使用系统。
2. 原生 Web Crypto TOTP 算法符合 RFC 6238 规范，时间窗口容差与算法校验测试 100% 通过。
3. 用户可在 `/account/security` 自主绑定并开启 Google 身份验证器，亦可凭当前密码自主关闭。
4. 开启 2FA 的账号在登录时需通过 `/login/2fa` 动态验证码校验方可登入。
5. 找回密码页面明确提示未绑定 TOTP 无法找回密码；绑定 TOTP 用户可凭动态口令成功重置密码。
6. `pnpm run typecheck` 0 错误。
7. `pnpm run test` 全部测试（包括原有 15 个套件和新增套件）100% 通过。

## 4. 验证命令
```bash
pnpm test test/totp.test.ts
pnpm test test/no-email-totp.test.ts
pnpm run typecheck
pnpm run test
```

## 5. 状态
DONE

## 6. 完成交付成果
- **数据库 Schema 与迁移 (`migrations/0002_add_totp_and_username.sql` & `src/db/schema.ts`)**:
  - 新增 `username` 唯一登录标识，`totp_secret` Base32 密钥存储字段，`totp_enabled` 开关字段；
  - 兼容现有数据库，为历史用户自动回填 username，完美满足旧表约束并支持纯用户名无邮箱运行；
  - 测试 mock-d1 自动顺序执行所有 migrations 目录迁移。
- **轻量级原生 TOTP 密码学实现 (`src/crypto/totp.ts`)**:
  - 基于 Web Crypto API 原生实现 RFC 6238 TOTP 与 RFC 4648 Base32 算法（HMAC-SHA1、动态截断、30 秒时间步长、6 位动态码、$\pm 1$ 窗口时间偏移容差）；
  - 提供 `generateTotpSecret`, `generateTotp`, `verifyTotp`, `generateTotpUri` 等完备接口，零外部 npm 库依赖。
- **认证服务层全面升级 (`src/services/auth.service.ts`)**:
  - `registerUser`: 支持纯用户名注册，无需邮箱阻断激活，账号立即直接可用；
  - `loginWithPassword`: 统一支持用户名或邮箱凭据登录，开启 TOTP 2FA 的账号自动进入二步验证流程；
  - `verifyLogin2fa`: 校验 6 位 Google Authenticator 动态口令并颁发正式会话凭据；
  - `enableTotp` / `disableTotp`: 支持用户自主开启与安全关闭（需校验密码）；
  - `resetPasswordWithTotp`: 找回密码通过 TOTP 校验重置，**未绑定 TOTP 账号强制友好拦截并拒绝，明确要求联系管理员处理**。
- **视图与交互路由全链路改造 (`src/views/` & `src/routes/auth.ts`)**:
  - 新增 `/account/security` 安全中心：自主查看 2FA 状态、扫码/复制 Secret 绑定并开启 Google 身份验证器、凭密码关闭 2FA；
  - 新增 `/login/2fa`：登录两步验证输入页；
  - 改造 `/register` & `/login`：支持纯用户名注册与双凭据登录；
  - 改造 `/forgot-password`：显著突出说明**无邮箱/短信环境下必须绑定 Google Authenticator 否则无法找回**，提供一站式凭用户名 + 动态口令 + 新密码即时重设。
- **管理后台运维保障 (`src/views/admin/users.tsx` & `src/routes/admin-web.tsx`)**:
  - 用户列表中展示 username 及 2FA (TOTP) 启用状态，支持管理员一键“Reset 2FA”应急重置。
- **自动化测试保障 (`test/totp.test.ts` & `test/no-email-totp.test.ts` & `test/auth.routes.test.ts`)**:
  - 新增 19 个新测试用例，全量 17 个测试套件（151 个测试用例）及 TypeScript 类型检查 100% 通过。

