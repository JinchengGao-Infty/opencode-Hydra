# Task: 集成测试和文档

## Meta
- id: t010
- status: pending
- priority: P2
- depends: t007, t009
- allow: packages/opencode/src/hydra/**, packages/opencode/test/**, docs/**

## Description

编写集成测试和用户文档，确保 Hydra 功能完整可用。

### 1. 集成测试

**测试文件位置**：
```
packages/opencode/test/hydra/
├── task.test.ts          # Task 模块测试
├── agent.test.ts         # Agent 模块测试
├── event.test.ts         # Event 模块测试
├── core.test.ts          # HydraCore 测试
└── integration.test.ts   # 端到端集成测试
```

**integration.test.ts**：
```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { HydraCore } from "../../src/hydra/core"
import { TaskManager } from "../../src/hydra/task/manager"
import { AgentManager } from "../../src/hydra/agent/manager"
import { HydraEvent, HydraBus } from "../../src/hydra/event"
import fs from "fs/promises"
import path from "path"
import os from "os"

describe("Hydra Integration", () => {
  let testDir: string

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), `hydra-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    
    // 初始化 git repo（worktree 需要）
    await Bun.$`git init`.cwd(testDir)
    await Bun.$`git commit --allow-empty -m "init"`.cwd(testDir)
  })

  afterAll(async () => {
    // 清理
    await HydraCore.stop()
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it("should initialize Hydra", async () => {
    await HydraCore.init(testDir, { maxAgents: 2 })
    const status = await HydraCore.getStatus()
    expect(status.config).not.toBeNull()
    expect(status.config?.maxAgents).toBe(2)
  })

  it("should create a task", async () => {
    const task = await TaskManager.create(testDir, {
      title: "Test Task",
      description: "This is a test task",
      agentClass: "Coder",
      allow: ["src/**"],
    })

    expect(task.meta.id).toBeDefined()
    expect(task.meta.status).toBe("pending")
    expect(task.title).toBe("Test Task")
  })

  it("should list tasks", async () => {
    const tasks = await TaskManager.list(testDir)
    expect(tasks.length).toBeGreaterThan(0)
  })

  it("should spawn an agent", async () => {
    const agent = await AgentManager.spawn(testDir, {
      class: "Coder",
      name: "test-agent",
    })

    expect(agent.id).toBeDefined()
    expect(agent.class).toBe("Coder")
    expect(agent.status).toBe("idle")
  })

  it("should emit and receive events", async () => {
    const received: string[] = []

    const unsubscribe = HydraBus.on(HydraEvent.TaskCreated, (data) => {
      received.push(data.taskId)
    })

    HydraBus.emit(HydraEvent.TaskCreated, {
      taskId: "test-123",
      title: "Test",
    })

    expect(received).toContain("test-123")
    unsubscribe()
  })

  it("should run end-to-end workflow", async () => {
    // 这个测试需要实际的 opencode 可用
    // 可以 mock 或者标记为 skip
    
    // 1. 创建任务
    const task = await HydraCore.runTask({
      title: "Create hello.txt",
      description: "Create a file named hello.txt with content 'Hello World'",
      agentClass: "Coder",
      allow: ["*.txt"],
    })

    expect(task.meta.status).toBe("pending")

    // 2. 启动调度器
    await HydraCore.start()

    // 3. 等待完成（设置较短超时用于测试）
    // 实际测试中可能需要 mock opencode
    // const result = await HydraCore.waitForTask(task.meta.id, 60000)
    // expect(result.meta.status).toBe("done")

    await HydraCore.stop()
  })
})
```

### 2. 用户文档

**docs/hydra/README.md**：
```markdown
# Hydra - Multi-Agent Orchestration

Hydra 是 OpenCode 的多 Agent 编排系统，支持：
- 无人值守模式
- 任务文档驱动
- 多 Agent 并行
- 跨模型协作

## 快速开始

### 1. 初始化项目

```bash
cd your-project
opencode hydra init
```

这会创建 `.hydra/` 目录结构。

### 2. 创建任务

```bash
opencode hydra task create "实现用户登录功能" \
  --class Coder \
  --allow "src/auth/**" \
  --description "实现登录表单、API 接口和单元测试"
```

或者直接编辑任务文件 `.hydra/tasks/t001.md`。

### 3. 启动 Agent

```bash
# 自动分配任务
opencode hydra start

# 或手动指定
opencode hydra agent spawn Coder --task t001
```

### 4. 查看状态

```bash
# 总体状态
opencode hydra status

# 任务列表
opencode hydra task list

# Agent 列表
opencode hydra agent list

# 查看 Agent 日志
opencode hydra agent logs <agent-id>
```

### 5. 人工介入

```bash
# 向 Agent 发送消息
opencode hydra agent send <agent-id> "使用 JWT 认证"

# 暂停 Agent
opencode hydra agent pause <agent-id>

# 恢复 Agent
opencode hydra agent resume <agent-id>

# 终止 Agent
opencode hydra agent kill <agent-id>
```

## 任务文档格式

```markdown
# Task: 任务标题

## Meta
- id: t001
- status: pending
- agentClass: Coder
- model: anthropic/claude-sonnet
- thinking: medium
- allow: src/**, tests/**
- timeout: 3600
- depends: t000

## Description
详细的任务描述...

## Output
（Agent 完成后自动填写）

## Files Changed
（Agent 完成后自动填写）
```

## Agent 类

### 内置类

| 类名 | 描述 | 默认模型 |
|------|------|----------|
| Coder | 写代码 | claude-sonnet |
| Architect | 架构设计 | claude-opus |
| Writer | 写文档 | gemini-2 |
| Reviewer | 代码审查 | claude-opus |

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

## 配置

`.hydra/config.yaml`：

```yaml
server:
  port: 18790

pool:
  maxAgents: 3
  worktreeRoot: .hydra/worktrees

defaults:
  timeout: 3600
  model: anthropic/claude-sonnet
  thinking: medium
```

## API 使用

```typescript
import { HydraCore, TaskManager, AgentManager } from "opencode/hydra"

// 初始化
await HydraCore.init("/path/to/project")

// 创建任务
const task = await TaskManager.create(projectRoot, {
  title: "实现功能",
  description: "...",
  agentClass: "Coder",
})

// 启动调度器
await HydraCore.start()

// 等待完成
const result = await HydraCore.waitForTask(task.meta.id)
```

## 事件

```typescript
import { HydraEvent, HydraBus } from "opencode/hydra"

// 监听任务完成
HydraBus.on(HydraEvent.TaskCompleted, (data) => {
  console.log(`Task ${data.taskId} completed!`)
})

// 监听 Agent 等待
HydraBus.on(HydraEvent.AgentWaiting, (data) => {
  console.log(`Agent ${data.agentId} needs help: ${data.reason}`)
})
```
```

### 3. 更新主 README

在项目根目录的 README.md 中添加 Hydra 介绍。

## Acceptance Criteria

- [ ] Task 模块单元测试通过
- [ ] Agent 模块单元测试通过
- [ ] Event 模块单元测试通过
- [ ] HydraCore 单元测试通过
- [ ] 集成测试通过（可能需要 mock）
- [ ] 用户文档完整
- [ ] README 包含快速开始指南
- [ ] API 文档完整
- [ ] 示例代码可运行

## Notes

- 集成测试可能需要 mock opencode 进程
- 文档要简洁实用
- 示例代码要可复制运行
