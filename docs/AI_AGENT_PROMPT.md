# AI Agent 项目开发提示词与规格说明

本文档记录了系统的工程工作规则与产品规范。

---

## 1. 文档与事实来源
以下文件是项目工作的事实来源：
- 项目规则：`AGENTS.md`、`CONTRIBUTING.md` 或同类文件
- 总目标：`docs/AI/GOAL.md`
- 任务索引：`docs/AI/TASK_INDEX.md`
- 当前状态：`docs/AI/SESSION_STATE.md`
- 当前任务：`docs/AI/tasks/TASK-xxx.md`
- 架构说明：`docs/AI/ARCHITECTURE.md`
- 重要决策：`docs/AI/DECISIONS.md`

## 2. 工作原则
1. 一次只处理一个 Goal 和一个当前 Task。
2. 一个 session 默认最多完成一个 Task。
3. 不实现当前 Task 之外的功能。
4. 不修改与任务无关的文件。
5. 不删除、覆盖或回滚用户已有修改。
6. 不执行 reset、checkout、递归删除等破坏性操作。
7. 不主动提交、推送、发布或修改生产环境。
8. 不添加依赖，除非任务明确需要且现有功能无法满足。
9. 不假设使用某种语言、框架、包管理器或测试工具。
10. 所有结论必须基于实际读取或实际运行的结果。
11. 没有运行过的测试不得声称通过。
12. 发现额外工作时，创建新 Task，不要立即实现。

## 3. 项目识别
- 读取构建文件、依赖文件、锁文件、入口文件和测试配置。
- 使用仓库已有的构建、测试、格式化和静态检查命令。
- 如果没有自动化测试，必须提供可执行的手动验证方法。

## 4. 启动流程
1. 确认当前目录是项目根目录。
2. 查看仓库状态，例如 `git status --short`。
3. 读取项目规则。
4. 读取 `GOAL.md`、`TASK_INDEX.md` 和 `SESSION_STATE.md`。
5. 读取当前 Task 文件和直接相关的源代码、测试、配置。
6. 检查 Task 的所有依赖是否已经完成。
7. 如果有上次的 IN_PROGRESS Task，优先恢复它。
8. 否则选择第一个依赖已满足的 TODO Task。
9. 检查当前仓库是否符合 Task 的假设。
10. 在修改代码前输出执行计划。

## 5. Task 拆分规则
每个 Task 必须满足：
- 只有一个明确目标。
- 产生一个可观察、可验证的结果。
- 尽量只涉及一个模块或一条集成路径。
- 默认预计 30 到 90 分钟完成。
- 默认不超过 5 个实现文件和 3 个测试文件。
- 有明确的输入、输出和验收标准。
- 有明确的允许修改文件范围。
- 有明确的验证命令。
- 有明确的依赖关系和风险说明。

## 6. Task 状态流转
`TODO -> IN_PROGRESS -> REVIEW -> DONE`
或分支到 `BLOCKED`。

## 7. 修改前计划格式
```text
Request Type:
Goal:
Current Behavior:
Current Task:
Dependencies:
Files To Read:
Files To Modify:
Files To Create:
Implementation Approach:
Acceptance Criteria:
Verification Method:
Risks and Assumptions:
```

## 8. 完成条件
- 实现已完成。
- 没有超出允许修改范围。
- 验收标准全部满足。
- 相关测试或验证命令已经实际运行。
- 相关文档已更新。
- 最终 diff 和仓库状态已检查。
- 已记录剩余风险和下一步任务。

## 9. 最终交接格式
```text
Goal:
Task:
Status: DONE | BLOCKED | REVIEW

Changed Files:
Created Files:

Implementation Summary:

Verification and Test Results:

Known Issues:

Remaining Work:

Next Task:
```
