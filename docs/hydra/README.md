# Hydra - Multi-Agent Orchestration

Hydra 是 OpenCode 的多 Agent 编排系统。它通过任务文档（`.hydra/tasks/*.md`）、Git worktree 以及事件总线来协调多个 Agent 并行工作。

## 快速开始（CLI）

> 在你的项目根目录运行以下命令。

### 1) 创建任务

```bash
opencode hydra task create "实现用户登录功能" \
  --class Coder \
  --description "实现登录表单、API 接口和单元测试" \
  --allow "src/auth/**" \
  --allow "test/**"
```

任务会写入 `.hydra/tasks/<id>.md`。

### 2) 查看任务

```bash
# 列表
opencode hydra task list

# 详情
opencode hydra task show <task-id>

# 取消
opencode hydra task cancel <task-id>
```

### 3) 启动 Agent（手动分配任务）

```bash
# 创建一个 Agent，并绑定任务
opencode hydra agent spawn Coder --task <task-id>

# 查看 Agent 列表
opencode hydra agent list

# 查看日志（可加 --follow 持续跟随）
opencode hydra agent logs <agent-id> --follow
```

### 4) 人工介入

```bash
# 向 Agent 发送消息
opencode hydra agent send <agent-id> "使用 JWT 认证"

# 暂停 / 恢复
opencode hydra agent pause <agent-id>
opencode hydra agent resume <agent-id>

# 终止（可选 --cleanup 删除 worktree）
opencode hydra agent kill <agent-id> --cleanup
```

### 5) 状态汇总

```bash
opencode hydra status
```

## 任务文档格式

Hydra 任务是标准 Markdown 文件，示例：

```markdown
# Task: 任务标题

## Meta
- id: t001
- status: pending
- agentClass: Coder
- model: anthropic/claude-sonnet
- thinking: medium
- allow: src/**, test/**
- timeout: 3600
- depends: t000
- created: 2026-01-31T18:00:00Z
- started: 2026-01-31T18:01:00Z
- finished: 2026-01-31T18:10:00Z

## Description
详细的任务描述...

## Output
（Agent 完成后自动填写）

## Files Changed
- src/auth/login.ts
- test/auth/login.test.ts
```

## Agent 类

### 内置类

| 类名 | 描述 |
|------|------|
| Coder | 写代码 |
| Architect | 架构设计 |
| Writer | 写文档 |
| Reviewer | 代码审查 |

### 自定义类

在 `.hydra/agents.yaml` 中定义：

```yaml
classes:
  MyAgent:
    description: "自定义 Agent"
    prompt: |
      你是一个自定义 Agent...
    defaultModel: openai/gpt-5
    defaultThinking: high
```

## API（开发者）

Hydra 的主要模块：

- `HydraCore`：核心调度器（创建任务、分配、监听 Agent 结束并更新任务）
- `TaskManager`：任务文件读写与状态更新
- `AgentManager`：worktree / 子进程管理、日志读取、消息发送
- `HydraBus` / `HydraEvent`：事件发布与订阅

事件示例：

```ts
import { HydraBus, HydraEvent } from "@/hydra/event"

HydraBus.on(HydraEvent.TaskCompleted, (data) => {
  console.log(`Task ${data.taskId} completed:`, data.filesChanged)
})
```
