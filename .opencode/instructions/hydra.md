# Hydra 使用指南

你可以使用 Hydra 多 Agent 系统来调度子 AI 完成任务。

## ⚠️ 重要：使用 MCP 工具，不要用 CLI

调度子 AI 时，**必须使用 MCP 工具**，不要用 bash 执行 CLI 命令。

✅ 正确：
```
hydra_agent_spawn({ class: "Coder", task: "t001" })
```

❌ 错误：
```
bash: opencode hydra agent spawn Coder --task t001
```

**原因**：只有通过 MCP 工具调度，子 AI 才会出现在 TUI 的 tab 里，用户才能看到和控制。

---

## 可用的 MCP 工具

### 状态查询
- `hydra_status()` — 总体状态
- `hydra_task_list(status?)` — 任务列表
- `hydra_task_show(id)` — 任务详情
- `hydra_agent_list(status?)` — Agent 列表
- `hydra_agent_show(id)` — Agent 详情
- `hydra_agent_logs(id, lines?)` — Agent 日志

### 任务管理
- `hydra_task_create({ title, description, class?, allow[], model?, thinking?, timeout?, depends[] })` — 创建任务
- `hydra_task_cancel(id)` — 取消任务

### Agent 管理
- `hydra_agent_spawn({ class, task?, model?, thinking?, prompt?, callback? })` — 启动 Agent
- `hydra_agent_send(id, message)` — 给 Agent 发消息
- `hydra_agent_pause(id)` — 暂停 Agent
- `hydra_agent_resume(id)` — 恢复 Agent
- `hydra_agent_kill(id, cleanup?)` — 终止 Agent

### 调度控制
- `hydra_start()` — 启动自动调度
- `hydra_stop()` — 停止自动调度

---

## 内置 Agent 类型

| 类名 | 模型 | 思考级别 | 用途 |
|------|------|----------|------|
| **Coder** | claude-sonnet | medium | 写代码、修 bug、写测试 |
| **Codex** | openai/codex | high | 深度思考，复杂任务 |
| **Architect** | claude-opus | high | 架构设计、技术选型 |
| **Writer** | gemini-2 | low | 写文档、README |
| **Reviewer** | claude-opus | high | 代码审查 |

---

## 示例流程

```
# 1. 创建任务
task = hydra_task_create({
  title: "实现用户认证",
  description: "使用 JWT 实现登录注册",
  class: "Coder",
  allow: ["src/auth/**"]
})

# 2. 启动 Agent（会出现在 TUI tab 里）
agent = hydra_agent_spawn({
  class: "Coder",
  task: task.meta.id
})

# 3. 查看进度
hydra_agent_logs(agent.id, lines: 50)

# 4. 如果需要，给 Agent 发消息
hydra_agent_send(agent.id, "用 PostgreSQL 数据库")
```

---

## 子 AI 完成后

子 AI 完成任务后会在日志中标记 `✅ 完成`，状态变为 `done`。

你可以用 `hydra_agent_show(id)` 检查状态，或用 `hydra_task_show(taskId)` 查看任务结果。
