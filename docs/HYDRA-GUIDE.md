---
name: opencode-hydra
description: Multi-agent orchestration with OpenCode Hydra. Spawn and manage sub-agents to work on tasks in parallel.
metadata: {"openclaw":{"emoji":"🐙","requires":{"anyBins":["opencode"]}}}
---

# OpenCode Hydra - 多 Agent 编排系统

Hydra 是 OpenCode 的内置多 Agent 编排系统，让你能够：
- 创建任务并分配给子 AI
- 并行运行多个子 AI
- 在 TUI 中实时查看子 AI 的工作
- 通过 MCP 工具调度（适合 AI 主控）
- 通过 CLI 命令调度（适合脚本/自动化）

---

## 核心概念

### Task（任务）
任务是工作单元，包含：
- **title**: 任务标题
- **description**: 详细描述
- **allow**: 允许修改的文件（glob 模式）
- **agentClass**: 使用的 Agent 类型
- **status**: pending → running → done/failed/cancelled

### Agent（代理）
Agent 是执行任务的子 AI 进程：
- 每个 Agent 运行在独立的 git worktree 中
- 有自己的状态：idle/running/paused/waiting/done/failed
- 可以暂停、恢复、终止

### AgentClass（代理类）
预定义的 Agent 配置模板：

| 类名 | 模型 | 思考级别 | 用途 |
|------|------|----------|------|
| **Coder** | claude-sonnet | medium | 写代码、修 bug、写测试 |
| **Codex** | openai/codex | high | 深度思考，复杂任务，2h 超时 |
| **Architect** | claude-opus | high | 架构设计、技术选型 |
| **Writer** | gemini-2 | low | 写文档、README |
| **Reviewer** | claude-opus | high | 代码审查 |

---

## 使用方式

### 方式 1：TUI 模式（推荐给人类用户）

在 TUI 中，你可以看到所有子 AI 的 tab，实时查看他们的工作。

```bash
# 启动 OpenCode TUI
opencode

# 在 TUI 中，主控 AI 会调用 Hydra MCP 工具
# 子 AI 的 tab 会自动出现
# 用 Tab/Shift+Tab 切换查看
```

### 方式 2：CLI 模式（适合脚本/自动化）

```bash
# 查看状态
opencode hydra status

# 查看可用的 Agent 类
opencode hydra agent classes

# 创建任务
opencode hydra task create "重构 auth 模块" \
  --description "将 auth 逻辑拆分到独立模块" \
  --class Coder \
  --allow "src/auth/**"

# 启动 Agent 执行任务
opencode hydra agent spawn Coder --task <task-id>

# 查看 Agent 列表
opencode hydra agent list

# 查看 Agent 日志
opencode hydra agent logs <agent-id>

# 给 Agent 发消息
opencode hydra agent send <agent-id> "用 PostgreSQL，不要用 MySQL"

# 暂停/恢复/终止 Agent
opencode hydra agent pause <agent-id>
opencode hydra agent resume <agent-id>
opencode hydra agent kill <agent-id>
```

### 方式 3：MCP 工具（适合 AI 主控）

当你作为主控 AI 时，使用这些 MCP 工具调度子 AI：

#### 状态查询
```
hydra_status()                    # 总体状态
hydra_task_list(status?)          # 任务列表
hydra_task_show(id)               # 任务详情
hydra_agent_list(status?)         # Agent 列表
hydra_agent_show(id)              # Agent 详情
hydra_agent_logs(id, lines?)      # Agent 日志
```

#### 任务管理
```
hydra_task_create({
  title: "任务标题",
  description: "详细描述",
  class: "Coder",              # Agent 类型
  allow: ["src/**"],           # 允许修改的文件
  model: "anthropic/claude-sonnet",  # 可选，覆盖默认模型
  thinking: "medium",          # low/medium/high
  timeout: 3600,               # 超时秒数
  depends: ["task-id-1"]       # 依赖的任务
})

hydra_task_cancel(id)
```

#### Agent 管理
```
hydra_agent_spawn({
  class: "Coder",              # Agent 类型
  task: "task-id",             # 绑定的任务
  model: "...",                # 可选，覆盖模型
  thinking: "medium",          # 可选，覆盖思考级别
  prompt: "额外提示",          # 可选，发送初始消息
  callback: {                  # 可选，完成时回调
    url: "http://...",         # HTTP webhook
    command: "echo {event}",   # 或命令行
    events: ["completed", "failed", "waiting"]
  }
})

hydra_agent_send(id, message)  # 发消息
hydra_agent_pause(id)          # 暂停
hydra_agent_resume(id)         # 恢复
hydra_agent_kill(id, cleanup?) # 终止
```

#### 调度控制
```
hydra_start()   # 启动自动调度（自动分配 pending 任务）
hydra_stop()    # 停止自动调度
```

---

## 回调通知机制

当子 AI 完成/失败/等待输入时，可以通过回调通知主控：

### HTTP Webhook
```
hydra_agent_spawn({
  class: "Coder",
  task: "t001",
  callback: {
    url: "http://localhost:8080/webhook",
    events: ["completed", "failed"],
    headers: { "Authorization": "Bearer xxx" }
  }
})
```

回调 payload：
```json
{
  "event": "agent.completed",
  "agentId": "agent-xxx",
  "taskId": "t001",
  "timestamp": "2026-02-01T10:30:00Z",
  "data": {
    "output": "完成了重构...",
    "filesChanged": ["src/auth.ts"]
  }
}
```

### 命令行回调
```
hydra_agent_spawn({
  class: "Coder",
  task: "t001",
  callback: {
    command: "echo 'Agent {agentId} {event}' >> /tmp/events.log",
    events: ["completed", "failed", "waiting"]
  }
})
```

支持的变量：`{agentId}`, `{taskId}`, `{event}`, `{timestamp}`, `{reason}`, `{error}`, `{output}`, `{filesChanged}`

---

## 配置

### 项目配置 `.hydra/config.yaml`

```yaml
defaults:
  model: anthropic/claude-sonnet
  thinking: medium
  timeout: 3600
  maxAgents: 3

scheduler:
  autoStart: false
  retryOnFail: true
  maxRetries: 2

classes:
  # 自定义或覆盖 Agent 类
  MyAgent:
    description: "我的自定义 Agent"
    model: openai/gpt-4
    thinking: high
    prompt: |
      你是一个专门处理 XXX 的 Agent...
    timeout: 7200

providers:
  # 自定义 provider 配置
  anthropic:
    apiKey: sk-xxx
  openai:
    endpoint: https://api.example.com/v1
    apiKey: sk-xxx
```

### 全局配置 `~/.hydra/config.yaml`

同上，会与项目配置合并（项目配置优先）。

---

## 完整示例：AI 主控调度子 AI

```
# 1. 创建任务
task = hydra_task_create({
  title: "实现用户认证模块",
  description: "使用 JWT 实现登录/注册/刷新 token",
  class: "Coder",
  allow: ["src/auth/**", "src/middleware/**", "tests/auth/**"]
})

# 2. 启动 Agent 执行任务
agent = hydra_agent_spawn({
  class: "Coder",
  task: task.meta.id,
  callback: {
    command: "echo '[{event}] Agent {agentId} finished task {taskId}' >> /tmp/hydra.log"
  }
})

# 3. 查看进度
hydra_agent_logs(agent.id, lines: 50)

# 4. 如果 Agent 需要输入
hydra_agent_send(agent.id, "数据库用 PostgreSQL")

# 5. 检查状态
hydra_agent_show(agent.id)
# status: "done" / "failed" / "waiting"
```

---

## 子 AI 的工作约定

子 AI 在执行任务时应遵循：

1. **日志记录**：在 `.hydra/agent-log.md` 中记录进度
2. **完成标记**：完成后在日志中写 `✅ 完成` 并总结
3. **等待标记**：需要输入时写 `⚠️ 等待输入` 并说明问题
4. **文件限制**：只修改 `allow` 列表中的文件
5. **不要提交**：不要执行 git commit/push（由主控处理）

---

## 并行任务

Hydra 支持并行运行多个 Agent：

```
# 创建多个任务
task1 = hydra_task_create({ title: "实现 API", class: "Coder", ... })
task2 = hydra_task_create({ title: "写文档", class: "Writer", ... })
task3 = hydra_task_create({ title: "代码审查", class: "Reviewer", depends: [task1.meta.id] })

# 启动自动调度（会自动分配任务给空闲 Agent）
hydra_start()

# 或手动启动
hydra_agent_spawn({ class: "Coder", task: task1.meta.id })
hydra_agent_spawn({ class: "Writer", task: task2.meta.id })
# task3 会等 task1 完成后自动启动
```

---

## 注意事项

1. **TUI vs CLI**：CLI 调度时看不到实时 TUI，只能用 `agent logs` 查看日志
2. **worktree 隔离**：每个 Agent 在独立 worktree 中工作，互不干扰
3. **资源限制**：`maxAgents` 控制最大并行数，默认 3
4. **超时**：默认 1 小时，Codex 类默认 2 小时
5. **回调可靠性**：回调失败不影响主流程（静默失败）

---

## 故障排查

```bash
# 查看总体状态
opencode hydra status

# 查看 Agent 详情
opencode hydra agent show <id> --json

# 查看完整日志
opencode hydra agent logs <id>

# 强制终止并清理 worktree
opencode hydra agent kill <id> --cleanup
```
