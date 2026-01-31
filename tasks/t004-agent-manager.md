# Task: 实现 AgentInstance 和 AgentManager

## Meta
- id: t004
- status: pending
- priority: P1
- depends: t003
- allow: packages/opencode/src/hydra/**

## Description

实现 Agent 实例管理，包括实例化、生命周期管理、消息发送等。

### 1. 文件位置

```
packages/opencode/src/hydra/agent/
├── instance.ts   # AgentInstance 数据结构
├── manager.ts    # AgentManager 实现
└── index.ts      # 更新导出
```

### 2. AgentInstance 数据结构 (instance.ts)

```typescript
import z from "zod"
import { AgentClass } from "./class"

export namespace AgentInstance {
  export const Status = z.enum([
    "idle",      // 空闲，等待任务
    "running",   // 正在执行
    "paused",    // 已暂停
    "waiting",   // 等待输入
    "done",      // 完成
    "failed",    // 失败
  ])
  export type Status = z.infer<typeof Status>

  export const Info = z.object({
    id: z.string(),                              // 实例 ID
    class: z.string(),                           // 来自哪个类
    name: z.string(),                            // 实例名称
    model: z.string(),                           // 使用的模型
    thinking: AgentClass.Thinking,               // 思考强度
    worktree: z.string(),                        // worktree 路径
    taskId: z.string().optional(),               // 当前任务 ID
    status: Status,                              // 状态
    pid: z.number().optional(),                  // 进程 ID
    created: z.string(),                         // 创建时间
    started: z.string().optional(),              // 开始时间
    finished: z.string().optional(),             // 结束时间
  })
  export type Info = z.infer<typeof Info>

  /**
   * 生成实例 ID
   */
  export function generateId(): string

  /**
   * 创建实例对象（不启动进程）
   */
  export function create(input: {
    class: string
    name: string
    model: string
    thinking: AgentClass.Thinking
    worktree: string
    taskId?: string
  }): Info
}
```

### 3. AgentManager 实现 (manager.ts)

```typescript
import { AgentClass } from "./class"
import { AgentInstance } from "./instance"
import { Worktree } from "../../worktree"
import { Task } from "../task"
import { $ } from "bun"
import path from "path"

export namespace AgentManager {
  // 运行中的 Agent 实例（内存中）
  const instances = new Map<string, AgentInstance.Info>()
  
  // Agent 进程
  const processes = new Map<string, Subprocess>()

  /**
   * 实例化 Agent
   * 1. 获取 AgentClass
   * 2. 创建 worktree（使用 OpenCode 的 Worktree 模块）
   * 3. 创建 AgentInstance
   * 4. 保存到内存
   */
  export async function spawn(projectRoot: string, input: {
    class: string
    name?: string
    model?: string
    thinking?: AgentClass.Thinking
    taskId?: string
  }): Promise<AgentInstance.Info>

  /**
   * 列出所有 Agent 实例
   */
  export function list(filter?: {
    status?: AgentInstance.Status[]
  }): AgentInstance.Info[]

  /**
   * 获取 Agent 实例
   */
  export function get(id: string): AgentInstance.Info | undefined

  /**
   * 启动 Agent 执行任务
   * 1. 读取任务文档
   * 2. 构建 prompt
   * 3. 启动 opencode run --unattended
   * 4. 更新状态为 running
   */
  export async function start(projectRoot: string, agentId: string): Promise<void>

  /**
   * 向 Agent 发送消息
   * 通过 stdin 写入消息
   */
  export async function send(agentId: string, message: string): Promise<void>

  /**
   * 暂停 Agent
   * 发送 SIGSTOP 信号
   */
  export async function pause(agentId: string): Promise<void>

  /**
   * 恢复 Agent
   * 发送 SIGCONT 信号
   */
  export async function resume(agentId: string): Promise<void>

  /**
   * 终止 Agent
   * 1. 发送 SIGTERM
   * 2. 等待退出
   * 3. 清理 worktree（可选）
   */
  export async function kill(agentId: string, options?: {
    cleanup?: boolean  // 是否删除 worktree
  }): Promise<void>

  /**
   * 获取 Agent 日志
   */
  export async function logs(agentId: string, options?: {
    lines?: number
    follow?: boolean
  }): Promise<string>

  /**
   * 更新 Agent 状态
   */
  export function updateStatus(agentId: string, status: AgentInstance.Status): void

  /**
   * 清理已完成的 Agent
   */
  export async function cleanup(agentId: string): Promise<void>
}
```

### 4. 内部辅助函数

```typescript
/**
 * 构建 Agent 执行的 prompt
 */
function buildPrompt(
  agentClass: AgentClass.Info,
  task: Task.Info,
  worktree: string
): string {
  return `
${agentClass.prompt}

---

# 当前任务

${task.title}

## 任务描述

${task.description}

## 允许修改的文件

${task.meta.allow.join(", ") || "所有文件"}

## 工作目录

${worktree}

## 重要提示

1. 在 .hydra/agent-log.md 中记录你的工作进度
2. 遇到困难时，在日志中标记 "⚠️ 等待输入" 并说明问题
3. 完成后在日志中标记 "✅ 完成" 并总结所做的更改
4. 不要修改 allow 列表之外的文件
`
}

/**
 * 启动 opencode 进程
 */
async function startOpenCodeProcess(
  agentId: string,
  worktree: string,
  model: string,
  thinking: string,
  prompt: string
): Promise<Subprocess>

/**
 * 监听进程输出，更新状态
 */
async function watchProcess(
  agentId: string,
  proc: Subprocess
): Promise<void>
```

### 5. 持久化（可选）

Agent 实例信息也可以持久化到文件：

```
.hydra/
├── agents/
│   ├── agent-abc123.json
│   └── agent-def456.json
```

这样重启后可以恢复状态。

## Acceptance Criteria

- [ ] AgentInstance.Info schema 定义正确
- [ ] AgentInstance.generateId() 生成唯一 ID
- [ ] AgentManager.spawn() 创建 worktree 和实例
- [ ] AgentManager.start() 启动 opencode 进程
- [ ] AgentManager.send() 能向进程发送消息
- [ ] AgentManager.pause/resume() 能暂停/恢复进程
- [ ] AgentManager.kill() 能终止进程并清理
- [ ] AgentManager.logs() 能读取日志
- [ ] 状态更新正确
- [ ] 有单元测试

## Notes

- 使用 OpenCode 现有的 Worktree 模块创建 worktree
- 进程管理使用 Bun.spawn
- 日志文件位置：`{worktree}/.hydra/agent-log.md`
- thinking 参数映射到 opencode 的 --variant 参数
