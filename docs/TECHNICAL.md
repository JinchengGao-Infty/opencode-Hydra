# OpenCode-Hydra 技术方案

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        hydra-server                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  REST API   │  │     CLI     │  │      EventBus       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    HydraCore                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │  │
│  │  │ TaskManager │  │ AgentManager│  │ ClassRegistry │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └───────────────┘  │  │
│  └─────────┼────────────────┼────────────────────────────┘  │
│            │                │                                │
│            ▼                ▼                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     AgentPool                            ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                  ││
│  │  │ Agent-1 │  │ Agent-2 │  │ Agent-3 │  ...             ││
│  │  │(wt-1)   │  │(wt-2)   │  │(wt-3)   │                  ││
│  │  └────┬────┘  └────┬────┘  └────┬────┘                  ││
│  └───────┼────────────┼────────────┼───────────────────────┘│
└──────────┼────────────┼────────────┼────────────────────────┘
           │            │            │
           ▼            ▼            ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │worktree1│  │worktree2│  │worktree3│
      │ opencode│  │ opencode│  │ opencode│
      └─────────┘  └─────────┘  └─────────┘
```

---

## 目录结构

```
packages/opencode/src/
├── hydra/                      # Hydra 核心模块（新增）
│   ├── index.ts                # 导出
│   ├── core.ts                 # HydraCore 主类
│   ├── task/
│   │   ├── task.ts             # Task 数据结构
│   │   ├── manager.ts          # TaskManager
│   │   └── parser.ts           # 解析 task.md
│   ├── agent/
│   │   ├── class.ts            # AgentClass 定义
│   │   ├── instance.ts         # AgentInstance
│   │   ├── manager.ts          # AgentManager
│   │   ├── pool.ts             # AgentPool
│   │   └── logger.ts           # Agent 日志系统
│   ├── event/
│   │   ├── bus.ts              # EventBus
│   │   └── events.ts           # 事件定义
│   ├── server/
│   │   ├── api.ts              # REST API
│   │   └── routes.ts           # 路由定义
│   └── cli/
│       ├── commands.ts         # CLI 命令
│       └── index.ts            # CLI 入口
│
├── cli/
│   └── hydra.ts                # hydra 子命令入口（新增）
│
└── ... (现有代码)
```

---

## 核心模块设计

### 1. Task 模块

**task.ts** - 数据结构：
```typescript
import z from "zod"

export namespace Task {
  export const Status = z.enum(["pending", "running", "done", "failed", "cancelled"])
  export type Status = z.infer<typeof Status>

  export const Meta = z.object({
    id: z.string(),
    status: Status,
    agentClass: z.string().optional(),
    model: z.string().optional(),
    thinking: z.enum(["low", "medium", "high"]).optional(),
    allow: z.array(z.string()).optional(),
    timeout: z.number().optional(),
    depends: z.array(z.string()).optional(),
    created: z.string(),
    started: z.string().optional(),
    finished: z.string().optional(),
  })
  export type Meta = z.infer<typeof Meta>

  export const Info = z.object({
    meta: Meta,
    title: z.string(),
    description: z.string(),
    output: z.string().optional(),
    filesChanged: z.array(z.string()).optional(),
  })
  export type Info = z.infer<typeof Info>
}
```

**manager.ts** - 任务管理：
```typescript
export namespace TaskManager {
  // 创建任务
  export async function create(input: {
    title: string
    description: string
    agentClass?: string
    model?: string
    allow?: string[]
    timeout?: number
    depends?: string[]
  }): Promise<Task.Info>

  // 列出任务
  export async function list(filter?: {
    status?: Task.Status[]
  }): Promise<Task.Info[]>

  // 获取任务
  export async function get(id: string): Promise<Task.Info | undefined>

  // 更新任务状态
  export async function updateStatus(id: string, status: Task.Status): Promise<void>

  // 更新任务输出
  export async function updateOutput(id: string, output: string, filesChanged?: string[]): Promise<void>

  // 取消任务
  export async function cancel(id: string): Promise<void>

  // 获取可执行的任务（依赖已完成）
  export async function getReady(): Promise<Task.Info[]>
}
```

**parser.ts** - 解析 task.md：
```typescript
export namespace TaskParser {
  // 解析 task.md 文件
  export function parse(content: string): Task.Info

  // 序列化为 task.md
  export function serialize(task: Task.Info): string
}
```

---

### 2. Agent 模块

**class.ts** - Agent 类定义：
```typescript
export namespace AgentClass {
  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    prompt: z.string(),
    defaultModel: z.string(),
    defaultThinking: z.enum(["low", "medium", "high"]),
  })
  export type Info = z.infer<typeof Info>

  // 内置类
  export const BUILTIN: Record<string, Info> = {
    Coder: {
      name: "Coder",
      description: "写代码的 Agent",
      prompt: `你是一个专业的程序员...`,
      defaultModel: "anthropic/claude-sonnet",
      defaultThinking: "medium",
    },
    Architect: { ... },
    Writer: { ... },
    Reviewer: { ... },
  }

  // 加载用户自定义类
  export async function loadCustom(): Promise<Record<string, Info>>

  // 获取所有类
  export async function list(): Promise<Info[]>

  // 获取指定类
  export async function get(name: string): Promise<Info | undefined>
}
```

**instance.ts** - Agent 实例：
```typescript
export namespace AgentInstance {
  export const Status = z.enum(["idle", "running", "paused", "waiting", "done", "failed"])
  export type Status = z.infer<typeof Status>

  export const Info = z.object({
    id: z.string(),
    class: z.string(),
    name: z.string(),
    model: z.string(),
    thinking: z.enum(["low", "medium", "high"]),
    worktree: z.string(),
    taskId: z.string().optional(),
    status: Status,
    pid: z.number().optional(),
    created: z.string(),
    started: z.string().optional(),
    finished: z.string().optional(),
  })
  export type Info = z.infer<typeof Info>
}
```

**manager.ts** - Agent 管理：
```typescript
export namespace AgentManager {
  // 实例化 Agent
  export async function spawn(input: {
    class: string
    name?: string
    model?: string
    thinking?: "low" | "medium" | "high"
    taskId?: string
  }): Promise<AgentInstance.Info>

  // 列出 Agent
  export async function list(filter?: {
    status?: AgentInstance.Status[]
  }): Promise<AgentInstance.Info[]>

  // 获取 Agent
  export async function get(id: string): Promise<AgentInstance.Info | undefined>

  // 向 Agent 发送消息
  export async function send(id: string, message: string): Promise<void>

  // 暂停 Agent
  export async function pause(id: string): Promise<void>

  // 恢复 Agent
  export async function resume(id: string): Promise<void>

  // 终止 Agent
  export async function kill(id: string): Promise<void>

  // 获取 Agent 日志
  export async function logs(id: string, options?: {
    follow?: boolean
    lines?: number
  }): Promise<string>
}
```

**pool.ts** - Agent 池：
```typescript
export namespace AgentPool {
  export interface Config {
    maxAgents: number        // 最大并行数
    worktreeRoot: string     // worktree 根目录
  }

  // 初始化
  export async function init(config: Config): Promise<void>

  // 分配 Agent 执行任务
  export async function assign(taskId: string): Promise<AgentInstance.Info>

  // 回收 Agent
  export async function release(agentId: string): Promise<void>

  // 获取可用 Agent 数量
  export function available(): number
}
```

**logger.ts** - Agent 日志：
```typescript
export namespace AgentLogger {
  export interface LogEntry {
    timestamp: string
    level: "info" | "warn" | "error" | "success"
    message: string
    data?: Record<string, unknown>
  }

  // 创建 logger
  export function create(agentId: string, worktree: string): Logger

  export interface Logger {
    // 记录日志
    log(level: LogEntry["level"], message: string, data?: Record<string, unknown>): void

    // 快捷方法
    info(message: string, data?: Record<string, unknown>): void
    warn(message: string, data?: Record<string, unknown>): void
    error(message: string, data?: Record<string, unknown>): void
    success(message: string, data?: Record<string, unknown>): void

    // 标记等待输入
    waiting(reason: string): void

    // 读取日志
    read(options?: { lines?: number }): Promise<string>

    // 获取日志文件路径
    path(): string
  }
}
```

---

### 3. Event 模块

**events.ts** - 事件定义：
```typescript
import { BusEvent } from "@/bus/bus-event"
import z from "zod"

export namespace HydraEvent {
  // 任务事件
  export const TaskCreated = BusEvent.define("hydra.task.created", z.object({
    taskId: z.string(),
    title: z.string(),
  }))

  export const TaskStarted = BusEvent.define("hydra.task.started", z.object({
    taskId: z.string(),
    agentId: z.string(),
  }))

  export const TaskCompleted = BusEvent.define("hydra.task.completed", z.object({
    taskId: z.string(),
    agentId: z.string(),
    output: z.string(),
    filesChanged: z.array(z.string()),
  }))

  export const TaskFailed = BusEvent.define("hydra.task.failed", z.object({
    taskId: z.string(),
    agentId: z.string().optional(),
    error: z.string(),
  }))

  // Agent 事件
  export const AgentSpawned = BusEvent.define("hydra.agent.spawned", z.object({
    agentId: z.string(),
    class: z.string(),
    worktree: z.string(),
  }))

  export const AgentWaiting = BusEvent.define("hydra.agent.waiting", z.object({
    agentId: z.string(),
    reason: z.string(),
  }))

  export const AgentCompleted = BusEvent.define("hydra.agent.completed", z.object({
    agentId: z.string(),
    taskId: z.string().optional(),
  }))

  export const AgentFailed = BusEvent.define("hydra.agent.failed", z.object({
    agentId: z.string(),
    error: z.string(),
  }))

  export const AgentKilled = BusEvent.define("hydra.agent.killed", z.object({
    agentId: z.string(),
    reason: z.string().optional(),
  }))
}
```

**bus.ts** - 事件总线：
```typescript
export namespace HydraBus {
  // 订阅事件
  export function on<T>(event: BusEvent<T>, handler: (data: T) => void): () => void

  // 发送事件
  export function emit<T>(event: BusEvent<T>, data: T): void

  // 等待事件（Promise）
  export function once<T>(event: BusEvent<T>, filter?: (data: T) => boolean): Promise<T>
}
```

---

### 4. Server 模块

**api.ts** - REST API：
```typescript
import { Hono } from "hono"

export namespace HydraAPI {
  export function create(): Hono {
    const app = new Hono()

    // 任务 API
    app.post("/api/tasks", async (c) => { ... })
    app.get("/api/tasks", async (c) => { ... })
    app.get("/api/tasks/:id", async (c) => { ... })
    app.delete("/api/tasks/:id", async (c) => { ... })

    // Agent API
    app.post("/api/agents", async (c) => { ... })
    app.get("/api/agents", async (c) => { ... })
    app.get("/api/agents/:id", async (c) => { ... })
    app.get("/api/agents/:id/logs", async (c) => { ... })
    app.post("/api/agents/:id/send", async (c) => { ... })
    app.post("/api/agents/:id/pause", async (c) => { ... })
    app.post("/api/agents/:id/resume", async (c) => { ... })
    app.delete("/api/agents/:id", async (c) => { ... })

    // Agent 类 API
    app.get("/api/classes", async (c) => { ... })
    app.get("/api/classes/:name", async (c) => { ... })

    return app
  }
}
```

---

### 5. CLI 模块

**commands.ts** - CLI 命令：
```typescript
import yargs from "yargs"

export namespace HydraCLI {
  export function register(yargs: yargs.Argv) {
    return yargs
      .command("hydra", "Multi-agent orchestration", (yargs) => {
        return yargs
          // 任务命令
          .command("task", "Manage tasks", (yargs) => {
            return yargs
              .command("create <title>", "Create a task", { ... }, handleTaskCreate)
              .command("list", "List tasks", { ... }, handleTaskList)
              .command("status <id>", "Get task status", { ... }, handleTaskStatus)
              .command("cancel <id>", "Cancel a task", { ... }, handleTaskCancel)
          })
          // Agent 命令
          .command("agent", "Manage agents", (yargs) => {
            return yargs
              .command("spawn <class>", "Spawn an agent", { ... }, handleAgentSpawn)
              .command("list", "List agents", { ... }, handleAgentList)
              .command("logs <id>", "View agent logs", { ... }, handleAgentLogs)
              .command("send <id> <message>", "Send message to agent", { ... }, handleAgentSend)
              .command("pause <id>", "Pause agent", { ... }, handleAgentPause)
              .command("resume <id>", "Resume agent", { ... }, handleAgentResume)
              .command("kill <id>", "Kill agent", { ... }, handleAgentKill)
              .command("attach <id>", "Attach to agent", { ... }, handleAgentAttach)
          })
          // 状态命令
          .command("status", "Show overall status", { ... }, handleStatus)
          // 服务命令
          .command("server", "Start hydra server", { ... }, handleServer)
      })
  }
}
```

---

## 关键流程

### 1. 创建并执行任务

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  User   │────▶│ TaskManager │────▶│ AgentManager│────▶│ OpenCode │
└─────────┘     └─────────────┘     └─────────────┘     └──────────┘
     │                │                    │                  │
     │  1. create     │                    │                  │
     │  task          │                    │                  │
     │───────────────▶│                    │                  │
     │                │  2. save task.md   │                  │
     │                │───────────────────▶│                  │
     │                │                    │                  │
     │                │  3. spawn agent    │                  │
     │                │───────────────────▶│                  │
     │                │                    │  4. create       │
     │                │                    │  worktree        │
     │                │                    │─────────────────▶│
     │                │                    │                  │
     │                │                    │  5. run opencode │
     │                │                    │  --unattended    │
     │                │                    │─────────────────▶│
     │                │                    │                  │
     │                │                    │  6. emit events  │
     │                │                    │◀─────────────────│
     │                │                    │                  │
     │  7. notify     │                    │                  │
     │◀───────────────│◀───────────────────│                  │
```

### 2. Agent 执行流程

```typescript
async function runAgent(agent: AgentInstance.Info, task: Task.Info) {
  const logger = AgentLogger.create(agent.id, agent.worktree)
  
  logger.info("开始执行任务", { taskId: task.meta.id })
  
  // 构建 opencode 命令
  const args = [
    "run",
    "--unattended",
    "--format", "json",
    "-m", agent.model,
  ]
  
  // 添加 thinking 参数
  if (agent.thinking === "high") {
    args.push("--variant", "high")
  }
  
  // 构建 prompt
  const prompt = buildPrompt(agent, task, logger)
  
  // 执行 opencode
  const proc = Bun.spawn([
    "/Users/link/.opencode/bin/opencode",
    ...args,
    prompt,
  ], {
    cwd: agent.worktree,
    stdout: "pipe",
    stderr: "pipe",
  })
  
  // 监听输出，更新日志
  for await (const chunk of proc.stdout) {
    const event = JSON.parse(chunk)
    handleAgentEvent(agent, event, logger)
  }
  
  // 完成
  const exitCode = await proc.exited
  if (exitCode === 0) {
    logger.success("任务完成")
    HydraBus.emit(HydraEvent.AgentCompleted, { agentId: agent.id, taskId: task.meta.id })
  } else {
    logger.error("任务失败", { exitCode })
    HydraBus.emit(HydraEvent.AgentFailed, { agentId: agent.id, error: `Exit code: ${exitCode}` })
  }
}
```

### 3. 主控 AI 集成

```typescript
// 主控 AI（如 Link）可以这样使用：

// 1. 创建任务
const task = await TaskManager.create({
  title: "实现用户登录功能",
  description: "...",
  agentClass: "Coder",
  allow: ["src/auth/**"],
})

// 2. 等待完成
const result = await HydraBus.once(
  HydraEvent.TaskCompleted,
  (data) => data.taskId === task.meta.id
)

// 3. 或者监听所有事件
HydraBus.on(HydraEvent.AgentWaiting, async (data) => {
  // Agent 需要帮助，主控介入
  const agent = await AgentManager.get(data.agentId)
  const logs = await AgentManager.logs(data.agentId)
  
  // 分析日志，决定如何回复
  const response = await analyzeAndRespond(logs, data.reason)
  await AgentManager.send(data.agentId, response)
})
```

---

## 配置文件

**.hydra/config.yaml**：
```yaml
# Hydra 配置
server:
  port: 18790
  host: 127.0.0.1

pool:
  maxAgents: 3              # 最大并行 Agent 数
  worktreeRoot: .hydra/worktrees

defaults:
  timeout: 3600             # 默认超时（秒）
  model: anthropic/claude-sonnet
  thinking: medium

# 自定义 Agent 类
classes:
  CustomAgent:
    description: "自定义 Agent"
    prompt: |
      你是一个自定义 Agent...
    defaultModel: openai/gpt-5
    defaultThinking: high
```

---

## 实现计划

### Phase 1: 基础框架（P0）

1. **Task 模块**
   - [ ] Task 数据结构
   - [ ] TaskParser（解析/序列化 task.md）
   - [ ] TaskManager（CRUD）

2. **无人值守模式**
   - [ ] 修改 OpenCode 的 permission 系统，支持 auto-approve
   - [ ] 添加 `--unattended` 参数

### Phase 2: Agent 系统（P1）

3. **Agent 类系统**
   - [ ] AgentClass 定义
   - [ ] 内置类（Coder, Architect, Writer, Reviewer）
   - [ ] 加载用户自定义类

4. **Agent 实例管理**
   - [ ] AgentInstance 数据结构
   - [ ] AgentManager（spawn, list, kill）
   - [ ] 集成 OpenCode worktree

5. **Agent 日志系统**
   - [ ] AgentLogger
   - [ ] 日志格式和写入
   - [ ] 日志读取和 follow

### Phase 3: 事件和通知（P1）

6. **Event 模块**
   - [ ] 事件定义
   - [ ] HydraBus 实现
   - [ ] 集成到 Agent 执行流程

### Phase 4: 接口（P2）

7. **CLI**
   - [ ] hydra task 命令
   - [ ] hydra agent 命令
   - [ ] hydra status 命令

8. **REST API**
   - [ ] 任务 API
   - [ ] Agent API
   - [ ] 类 API

### Phase 5: 高级功能（P2-P3）

9. **人类介入**
   - [ ] pause/resume
   - [ ] send message
   - [ ] attach（交互模式）

10. **多 Agent 编排**
    - [ ] AgentPool
    - [ ] 任务调度
    - [ ] 依赖管理

11. **Web UI**（可选）
    - [ ] 状态面板
    - [ ] 日志查看
    - [ ] 操作按钮

---

## 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行时 | Bun | OpenCode 已使用 |
| 语言 | TypeScript | OpenCode 已使用 |
| Schema | Zod | OpenCode 已使用 |
| HTTP | Hono | 轻量、快速 |
| CLI | Yargs | OpenCode 已使用 |
| 进程管理 | Bun.spawn | 原生支持 |
| 文件监听 | fs.watch | 原生支持 |

---

*文档版本: v1.0*
*最后更新: 2026-01-31*
