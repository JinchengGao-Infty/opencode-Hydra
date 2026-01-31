# Task: MCP Server

## Meta
- id: t012
- status: pending
- priority: P0
- depends: t011
- allow: packages/opencode/src/hydra/**, packages/opencode/src/mcp/**

## Description

创建 Hydra MCP Server，让主控 AI（Link）能直接调用 Hydra 功能。

### MCP 工具列表

```typescript
// 状态查询
hydra_status()                    → 总体状态（任务数、Agent 数、运行中等）
hydra_task_list(status?)          → 任务列表，可按状态过滤
hydra_task_show(id)               → 任务详情
hydra_agent_list(status?)         → Agent 列表
hydra_agent_show(id)              → Agent 详情
hydra_agent_logs(id, lines?)      → Agent 日志（最近 N 行）

// 任务管理
hydra_task_create(title, description, class, allow[], model?, thinking?)
hydra_task_cancel(id)

// Agent 管理
hydra_agent_spawn(class, task?, model?, thinking?, prompt?)
hydra_agent_send(id, message)     → 给 Agent 发消息
hydra_agent_pause(id)
hydra_agent_resume(id)
hydra_agent_kill(id)

// 调度控制
hydra_start()                     → 启动自动调度
hydra_stop()                      → 停止自动调度
```

### 实现方式

1. **注册到 OpenCode MCP 系统**
   - 参考 `packages/opencode/src/mcp/` 现有实现
   - 创建 `hydra-server.ts`

2. **工具定义**
   ```typescript
   const tools = [
     {
       name: "hydra_status",
       description: "获取 Hydra 总体状态",
       inputSchema: { type: "object", properties: {} },
       handler: async () => HydraCore.getStatus()
     },
     // ...
   ]
   ```

3. **暴露给外部调用**
   - 通过 OpenCode 的 MCP 机制
   - 或独立 MCP server（`opencode hydra serve`）

## Acceptance Criteria

- [ ] 所有工具可通过 MCP 调用
- [ ] Link 能用 MCP 创建任务
- [ ] Link 能用 MCP spawn Agent
- [ ] Link 能用 MCP 查看状态和日志
- [ ] Link 能用 MCP 发消息给 Agent
