# TASK-027: 内置纯 TypeScript SVG 二维码生成引擎与 TOTP 安全中心扫码绑定落地

## 1. 任务说明
- **任务编号**: TASK-027
- **任务名称**: 内置纯 TypeScript SVG 二维码生成引擎与 TOTP 安全中心扫码绑定落地 (Built-in Pure TypeScript SVG QR Code Engine & TOTP Authenticator QR Scanning in Security Center)
- **依赖任务**: TASK-024, TASK-025
- **主要目标**:
  根据用户需求（“totp也要展示二维码可以扫吗”），解决之前 TOTP 绑定仅展示纯文本 Base32 密钥与链接、用户在手机端手动输入极其繁琐且易错的痛点：
  1. **零外部网络依赖的纯原生 SVG 二维码生成模块 (`src/crypto/qr.ts`)**:
     - 基于零依赖通用 QR 引擎 (`uqr`) 封装 `generateQrCodeSvg(text, options)`；
     - 100% 适配 Cloudflare Workers / Pages 边缘运行时，绝不调用 Google Chart API 或任何第三方图表 CDN，杜绝密钥泄露风险；
     - 支持 ECC Level M（15% 纠错能力）、安全静区（border: 2）及高对比度颜色控制。
  2. **个人安全中心 (`/account/security`) 视图与路由深度升级**:
     - 在首次绑定 TOTP 区域正中渲染清晰的白底高对比度矢量二维码卡片；
     - 清晰标注“使用 Google Authenticator / 微软验证器 / 1Password / Bitwarden 等 App 扫码”引导；
     - 保留下方“无法扫码？手动输入设置密钥”备选输入框与“复制 OTPAuth 链接”选项，兼顾桌面端扫码与单手机设备操作；
     - 在路由层（`GET /account/security` 与 `POST /account/security/enable-totp` 校验失败重渲染）自动生成并下发 `qrSvg`。
  3. **自动化测试与质量保障**:
     - 新建 `test/qr.test.ts` 全面验证 SVG 矢量图输出结构、viewBox、像素比例与参数控制；
     - 更新 `test/auth.routes.test.ts` 验证 `/account/security` 正确输出 SVG 二维码及扫码指引；
     - 保持 TypeScript 类型检查 0 错误与全量测试套件 100% 通过。

## 2. 影响文件
- `src/crypto/qr.ts` (新建)
- `test/qr.test.ts` (新建)
- `src/views/account/security.tsx` (更新)
- `src/routes/auth.ts` (更新)
- `test/auth.routes.test.ts` (更新)
- `docs/AI/tasks/TASK-027.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)

## 3. 验收标准
1. `src/crypto/qr.ts` 导出 `generateQrCodeSvg`，可稳定将 `otpauth://...` 转换为有效 SVG XML 字符串；
2. `/account/security` 页面在 TOTP 未启用时，展示高对比度 SVG 二维码、扫码说明，并提供手动密钥备份；
3. `pnpm test test/qr.test.ts` 4/4 测试通过；
4. `pnpm run typecheck` 0 错误；
5. `pnpm test` 全量测试套件 100% 通过。

## 4. 验证命令
```bash
pnpm test test/qr.test.ts
pnpm test test/auth.routes.test.ts
pnpm run typecheck
pnpm test
```

## 5. 状态
DONE

## 6. 完成记录
- 新建了 `src/crypto/qr.ts`，基于 Edge 兼容的零依赖引擎实现高保真矢量 SVG 二维码生成，支持自定义 quiet zone、纠错级别与模块颜色；
- 更新了 `src/views/account/security.tsx`，在个人安全中心提供了优雅的白色高对比度二维码卡片，移动端身份验证器（Google Authenticator / 1Password / 微软身份验证器等）可毫秒级扫码绑定，同时保留手动密钥作为单设备备份；
- 改造了 `src/routes/auth.ts`，在安全设置页初始访问和绑定验证失败回显时均可靠生成并传递 `qrSvg`；
- 编写了 `test/qr.test.ts` 并更新了 `test/auth.routes.test.ts`；
- 全量 17 个测试套件（140 个测试用例）及 TypeScript 类型检查 100% 通过。
