# TASK-020: 全链路端到端可视化测试与视觉文档构建

## 1. 任务说明
- **任务编号**: TASK-020
- **任务名称**: 全链路端到端可视化测试与视觉文档构建 (Comprehensive E2E Visual Testing & Documentation)
- **依赖任务**: TASK-018, TASK-019
- **主要目标**:
  为 `easy-oauth-worker` 构建全面的端到端视觉自动化测试体系与高质量 UI 走查文档：
  1. **自动化截图采集**: 编写基于 Node.js 原生 WebSocket 与 Chrome DevTools Protocol (CDP) 的无头浏览器截图脚本 `scripts/visual-test.js`。
  2. **核心界面覆盖**: 完整覆盖桌面端（1280x800）与移动端（375x812）下的 12 个关键交互场景（登录、注册、找回密码、重置密码、控制台仪表盘、用户管理、客户端管理、系统设置、OAuth Consent 授权页与协议错误拦截页）。
  3. **视觉测试技术报告**: 在 `docs/VISUAL_TEST_REPORT.md` 中以图文并茂的形式建立详尽的视觉测试验收报告。
  4. **资产回归测试**: 编写 `test/visual-assets.test.ts`，验证截图资产完整性与规范。
  5. **工程脚本集成**: 在 `package.json` 中注册 `pnpm run test:visual`，并在 `README.md` 中建立视觉文档导航。

## 2. 影响文件
- `docs/AI/tasks/TASK-020.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)
- `scripts/visual-test.js` (新建)
- `docs/screenshots/*.png` (新建 12 个图像文件)
- `docs/VISUAL_TEST_REPORT.md` (新建)
- `test/visual-assets.test.ts` (新建)
- `package.json` (更新)
- `README.md` (更新)

## 4. 验证命令
```bash
pnpm test test/visual-assets.test.ts
pnpm run typecheck
pnpm run test
```

## 5. 状态
DONE

## 6. 完成交付成果
- `scripts/visual-test.js`: 基于 Node.js 原生 WebSocket 和 Chrome DevTools Protocol (CDP) 的自动化视觉快照采集脚本，支持自动登录获取 Session、视口切换与全量界面高清截图。
- `docs/screenshots/`: 包含 12 个高清 PNG 截图文件，覆盖登录（桌面/移动）、注册、找回密码、重置密码、控制台仪表盘、用户管理、客户端管理、系统设置、OAuth Consent 授权（桌面/移动）与协议异常拦截。
- `docs/VISUAL_TEST_REPORT.md`: 详尽的端到端视觉与 UI/UX 验收技术文档，包含清晰图片展示、路由规格、响应式设计要素与安全交互分析。
- `test/visual-assets.test.ts`: 自动化回归测试，确保报告存在、12 张截图资产完整且具备有效 PNG 文件头。
- `package.json` & `README.md`: 注册 `pnpm run test:visual` 命令，并在 README 中提供视觉报告导航。
