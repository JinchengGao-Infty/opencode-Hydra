# Hydra TUI：主界面 Tab 管理子 Agent

这份文档记录了 `opencode-Hydra` 近期的 TUI 集成改动：把 Hydra 子 Agent 以“浏览器 Tab”的形式直接放进 OpenCode 主界面（聊天页），并支持查看日志与交互控制。

## 目标与效果

- **不再需要进入单独的 `/hydra` 页面**：主界面始终可见一个 Tab 栏。
- Tab 栏结构：`[ Main ] [ agent-1 ● ] [ agent-2 ○ ] ...`
  - `Main`：原来的聊天界面（Home/Session）
  - `agent-*`：该 Hydra 子 Agent 的日志输出与控制
- **子 Agent 完成后不会自动消失**：Tab 会保留，状态变为 `○ done/failed`，方便回看输出。

## 如何使用

1) 启动 OpenCode TUI（与以往一致）

2) 通过 Hydra（MCP 或 CLI）启动子 Agent

- 推荐：在主控侧使用 `hydra_*` MCP 工具创建任务/启动 Agent
- 或者：使用 CLI `opencode hydra ...`（开发调试场景）

3) 在 TUI 顶部 Tab 栏中点击/切换到对应子 Agent

- 看到该 Agent 的日志输出（尾部跟随）
- 底部输入框回车会把消息发给当前 Agent

## 快捷键

- `Ctrl+1..9`：跳到第 N 个 Agent Tab
- `Ctrl+0`：回到 `Main`
- `Tab / Shift+Tab`：在 Agent Tab 之间循环（仅在 Agent 视图下）
- `Ctrl+P`：pause 当前 Agent
- `Ctrl+R`：resume 当前 Agent
- `Ctrl+K`：kill 当前 Agent（不会自动清理 worktree）

## /hydra 命令行为

- 如果当前在 `Main`：`/hydra` 会切到第一个 Hydra Agent（若存在）
- 如果当前已在某个 Agent Tab：`/hydra` 会切回 `Main`

## 实现要点（开发者）

### 1) 为什么要加服务端 API（worker → main thread）

Hydra 的 `AgentManager/HydraCore` 运行在 worker 内，TUI UI 在主线程直接读内存会拿不到最新状态。因此新增了服务端路由 `GET /hydra/...`，TUI 通过 `@opencode-ai/sdk` 轮询拿到 worker 内状态并渲染 Tab。

### 2) 关键改动点（文件索引）

- TUI 主界面 Tab 集成：`packages/opencode/src/cli/cmd/tui/app.tsx`
- Hydra worker API：`packages/opencode/src/server/routes/hydra.ts`（挂载到 `packages/opencode/src/server/server.ts`）
- SDK 生成结果：`packages/sdk/js/src/v2/gen/*`
- Hydra MCP 返回格式修复：`packages/opencode/src/mcp/hydra-server.ts`（`{tasks}` / `{agents}`）
- Git worktree 识别修复：`packages/opencode/src/project/project.ts`（fallback 分支标记 `vcs: "git"`）
- System prompt 注入 Hydra 知识：`packages/opencode/src/session/system.ts` + `packages/opencode/src/session/prompt/hydra.txt`
- 任务完成后保留 Agent：`packages/opencode/src/hydra/core.ts`（不再自动 `AgentManager.cleanup()`）

### 3) MCP 调试增强（可选）

新增：
- `opencode mcp tools <name>`：列出 MCP server 的工具
- `opencode mcp call <server> <tool> --args '{}'`：调用 MCP 工具（debug）

