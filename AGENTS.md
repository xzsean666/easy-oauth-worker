# Agent Guidelines

本项目严格遵守工程开发代理规范，详情请查阅 [AI_AGENT_PROMPT.md](file:///ssd0/git/easy-oauth-worker/docs/AI_AGENT_PROMPT.md)。

## 事实来源与执行原则
- 总目标: `docs/AI/GOAL.md`
- 架构说明: `docs/AI/ARCHITECTURE.md`
- 关键决策: `docs/AI/DECISIONS.md`
- 任务索引: `docs/AI/TASK_INDEX.md`
- 当前状态: `docs/AI/SESSION_STATE.md`
- 任务定义: `docs/AI/tasks/TASK-xxx.md`

## 核心守则
1. 一次只处理一个 Goal 和一个当前 Task。
2. 一个 session 默认最多完成一个 Task。
3. 不修改与当前 Task 无关的文件。
4. 修改代码前必须输出计划（Request Type, Goal, Current Behavior, Current Task, Dependencies, Files To Read/Modify/Create, Implementation Approach, Acceptance Criteria, Verification Method, Risks and Assumptions）。
5. 必须实际运行验证命令（如类型检查、测试），严禁声称未运行过的测试通过。
6. 会话结束前更新 `docs/AI/SESSION_STATE.md` 并使用规范格式交接。
