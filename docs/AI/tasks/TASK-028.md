# TASK-028: 端到端可视化回归测试与全套高清界面截图更新 (含 TOTP 二维码扫码卡片)

## 1. 任务说明
- **任务编号**: TASK-028
- **任务名称**: 端到端可视化回归测试与全套高清界面截图更新 (E2E Visual Regression Testing & Full High-Resolution UI Screenshots Update)
- **依赖任务**: TASK-020, TASK-027
- **主要目标**:
  根据用户指令（“帮我更新图片撒”），针对刚在 TASK-027 落地完成的 TOTP 内嵌 SVG 二维码生成及安全中心交互，全面重新抓取并更新全链路 12 个界面的 2x Retina 高清视觉资产：
  1. **捕获最新的个人安全中心二维码视图 (`05_account_security_desktop.png`)**:
     - 真实展示服务端纯原生生成的白底高对比度矢量二维码卡片；
     - 展现身份验证器扫码引导以及手动密钥输入兜底排版；
  2. **端到端 12 张高清全景截图全量刷新**:
     - 基于真实 Chromium 152 无头 CDP 协议与 2x Retina 高清输出（桌面端 2560x1600，移动端 750x1624）；
     - 覆盖用户认证全流程（桌面登录、移动登录、纯用户名注册、TOTP 找回密码、安全中心）；
     - 覆盖管理员控制台（仪表盘、用户列表、OAuth 客户端、系统配置）；
     - 覆盖 OAuth 2.0 / OIDC 核心授权链（桌面端 Consent、移动端 Consent、非法重定向错误页）；
  3. **自动化测试验证**:
     - 运行 `test/visual-assets.test.ts`、TypeScript 类型检查及全量测试套件保障资产合法性与代码稳定性。

## 2. 影响文件
- `docs/screenshots/01_login_desktop.png` (更新)
- `docs/screenshots/02_login_mobile.png` (更新)
- `docs/screenshots/03_register_desktop.png` (更新)
- `docs/screenshots/04_forgot_password_desktop.png` (更新)
- `docs/screenshots/05_account_security_desktop.png` (更新，包含新版 SVG 二维码卡片)
- `docs/screenshots/06_admin_dashboard_desktop.png` (更新)
- `docs/screenshots/07_admin_users_desktop.png` (更新)
- `docs/screenshots/08_admin_clients_desktop.png` (更新)
- `docs/screenshots/09_admin_settings_desktop.png` (更新)
- `docs/screenshots/10_oauth_consent_desktop.png` (更新)
- `docs/screenshots/11_oauth_consent_mobile.png` (更新)
- `docs/screenshots/12_oauth_error_invalid_redirect.png` (更新)
- `docs/AI/tasks/TASK-028.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)

## 3. 验收标准
1. `05_account_security_desktop.png` 呈现清晰真实的 SVG 动态二维码卡片；
2. 全部 12 张截图均存在且大小有效（50KB ~ 300KB）；
3. `pnpm test test/visual-assets.test.ts` 100% 通过；
4. `pnpm run typecheck && pnpm test` 全量通过。

## 4. 验证命令
```bash
pnpm test test/visual-assets.test.ts
pnpm run typecheck
pnpm test
```

## 5. 状态
DONE

## 6. 完成记录
- 启动了本地 `wrangler dev` 真实服务并执行 `scripts/visual-test.js`；
- 全部 12 张 Retina 高清视图截图完成重新捕获并覆盖至 `docs/screenshots/`；
- 确认 `05_account_security_desktop.png` 居中完整呈现白底高对比度 SVG 二维码与扫码引导；
- 视觉资产测试 `test/visual-assets.test.ts` 3/3 全部通过；
- 全量 17 个测试套件（140 个测试用例）及 TypeScript 类型检查 100% 成功通过。
