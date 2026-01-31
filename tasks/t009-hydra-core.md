# Task: 实现 HydraCore 核心调度器

## Meta
- id: t009
- status: pending
- priority: P1
- depends: t002, t004, t006, t008
- allow: packages/opencode/src/hydra/**

## Description

实现 Hydra 的核心调度器，负责协调任务分配、Agent 管理和事件处理。

### 1. 文件位置

```
packages/opencode/src/hydra/
├── core.ts           # HydraCore 实现
└── index.ts          # 更新导出
```

### 2. HydraCore 实现 (core.ts)

```typescript
import { Task, TaskManager } from "./task"
import { AgentClass, AgentInstance, AgentManager, AgentLogger } from "./agent"
import { HydraEvent, HydraBus } from "./event"
import { Worktree } from "../worktree"

export namespace HydraCore {
  export interface Config {
    projectRoot: string
    maxAgents: number           // 最大并行 Agent 数
    pollInterval: number        // 任务轮询间隔（毫秒）
    defaultTimeout: number      // 默认任务超时（秒）
  }

  const DEFAULT_CONFIG: Omit<Config, "projectRoot"> = {
    maxAgents: 3,
    pollInterval: 5000,
    defaultTimeout: 3600,
  }

  let config: Config | null = null
  let running = false
  let pollTimer: Timer | null = null

  /**
   * 初始化 Hydra
   */
  export async function init(projectRoot: string, options?: Partial<Config>): Promise<void> {
    config = {
      projectRoot,
      ...DEFAULT_CONFIG,
      ...options,
    }

    // 初始化任务目录
    await TaskManager.init(projectRoot)

    // 设置事件监听
    setupEventHandlers()

    console.log(`[Hydra] Initialized in ${projectRoot}`)
  }

  /**
   * 启动调度器
   */
  export async function start(): Promise<void> {
    if (!config) throw new Error("Hydra not initialized")
    if (running) return

    running = true
    console.log("[Hydra] Scheduler started")

    // 开始轮询任务
    pollTimer = setInterval(pollTasks, config.pollInterval)

    // 立即执行一次
    await pollTasks()
  }

  /**
   * 停止调度器
   */
  export async function stop(): Promise<void> {
    running = false

    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    console.log("[Hydra] Scheduler stopped")
  }

  /**
   * 轮询并分配任务
   */
  async function pollTasks(): Promise<void> {
    if (!config || !running) return

    try {
      // 获取可执行的任务
      const readyTasks = await TaskManager.getReady(config.projectRoot)
      if (readyTasks.length === 0) return

      // 获取当前运行的 Agent 数量
      const runningAgents = AgentManager.list({ status: ["running", "waiting"] })
      const availableSlots = config.maxAgents - runningAgents.length

      if (availableSlots <= 0) return

      // 分配任务
      const tasksToAssign = readyTasks.slice(0, availableSlots)

      for (const task of tasksToAssign) {
        await assignTask(task)
      }
    } catch (error) {
      console.error("[Hydra] Poll error:", error)
    }
  }

  /**
   * 分配任务给 Agent
   */
  async function assignTask(task: Task.Info): Promise<void> {
    if (!config) return

    try {
      // 确定 Agent 类
      const className = task.meta.agentClass || "Coder"
      const agentClass = await AgentClass.get(config.projectRoot, className)

      if (!agentClass) {
        throw new Error(`Agent class not found: ${className}`)
      }

      // 实例化 Agent
      const agent = await AgentManager.spawn(config.projectRoot, {
        class: className,
        name: `${className.toLowerCase()}-${task.meta.id}`,
        model: task.meta.model || agentClass.defaultModel,
        thinking: task.meta.thinking || agentClass.defaultThinking,
        taskId: task.meta.id,
      })

      // 更新任务状态
      await TaskManager.updateStatus(config.projectRoot, task.meta.id, "running")

      // 发送事件
      HydraBus.emit(HydraEvent.TaskStarted, {
        taskId: task.meta.id,
        agentId: agent.id,
      })

      // 启动 Agent
      await AgentManager.start(config.projectRoot, agent.id)

    } catch (error) {
      console.error(`[Hydra] Failed to assign task ${task.meta.id}:`, error)

      // 标记任务失败
      await TaskManager.updateStatus(config.projectRoot, task.meta.id, "failed")

      HydraBus.emit(HydraEvent.TaskFailed, {
        taskId: task.meta.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * 设置事件处理器
   */
  function setupEventHandlers(): void {
    // Agent 完成时，更新任务状态
    HydraBus.on(HydraEvent.AgentCompleted, async (data) => {
      if (!config || !data.taskId) return

      try {
        const agent = AgentManager.get(data.agentId)
        if (!agent) return

        // 读取 Agent 日志获取输出
        const logs = await AgentManager.logs(data.agentId)
        const output = extractOutput(logs)
        const filesChanged = extractFilesChanged(logs)

        // 更新任务
        await TaskManager.updateOutput(config.projectRoot, data.taskId, output, filesChanged)
        await TaskManager.updateStatus(config.projectRoot, data.taskId, "done")

        // 发送事件
        HydraBus.emit(HydraEvent.TaskCompleted, {
          taskId: data.taskId,
          agentId: data.agentId,
          output,
          filesChanged,
        })

        // 清理 Agent
        await AgentManager.cleanup(data.agentId)

      } catch (error) {
        console.error(`[Hydra] Error handling agent completion:`, error)
      }
    })

    // Agent 失败时，更新任务状态
    HydraBus.on(HydraEvent.AgentFailed, async (data) => {
      if (!config || !data.taskId) return

      try {
        await TaskManager.updateStatus(config.projectRoot, data.taskId, "failed")

        HydraBus.emit(HydraEvent.TaskFailed, {
          taskId: data.taskId,
          agentId: data.agentId,
          error: data.error,
        })

        // 清理 Agent
        await AgentManager.cleanup(data.agentId)

      } catch (error) {
        console.error(`[Hydra] Error handling agent failure:`, error)
      }
    })

    // Agent 等待输入时，记录日志
    HydraBus.on(HydraEvent.AgentWaiting, (data) => {
      console.log(`[Hydra] Agent ${data.agentId} waiting: ${data.reason}`)
    })
  }

  /**
   * 从日志中提取输出
   */
  function extractOutput(logs: string): string {
    // 查找 "✅ 完成" 后的内容
    const match = logs.match(/✅ 完成[\s\S]*?\*\*总结\*\*:\s*([\s\S]*?)(?=\*\*修改的文件|$)/i)
    return match?.[1]?.trim() || ""
  }

  /**
   * 从日志中提取修改的文件
   */
  function extractFilesChanged(logs: string): string[] {
    const match = logs.match(/\*\*修改的文件\*\*:\s*([\s\S]*?)(?=\n\n|$)/i)
    if (!match) return []

    return match[1]
      .split("\n")
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter(Boolean)
  }

  // ============ 公开 API ============

  /**
   * 创建并立即执行任务
   */
  export async function runTask(input: {
    title: string
    description: string
    agentClass?: string
    model?: string
    thinking?: "low" | "medium" | "high"
    allow?: string[]
    timeout?: number
  }): Promise<Task.Info> {
    if (!config) throw new Error("Hydra not initialized")

    const task = await TaskManager.create(config.projectRoot, input)

    // 如果调度器在运行，任务会自动被分配
    // 如果没有运行，手动分配
    if (!running) {
      await assignTask(task)
    }

    return task
  }

  /**
   * 等待任务完成
   */
  export async function waitForTask(
    taskId: string,
    timeout?: number
  ): Promise<Task.Info> {
    if (!config) throw new Error("Hydra not initialized")

    // 等待任务完成或失败事件
    await HydraBus.once(
      HydraEvent.TaskCompleted,
      (data) => data.taskId === taskId,
      timeout
    ).catch(() => {
      // 检查是否失败
      return HydraBus.once(
        HydraEvent.TaskFailed,
        (data) => data.taskId === taskId,
        100
      )
    })

    // 返回最新的任务状态
    const task = await TaskManager.get(config.projectRoot, taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    return task
  }

  /**
   * 获取状态
   */
  export async function getStatus(): Promise<{
    running: boolean
    config: Config | null
    tasks: {
      total: number
      pending: number
      running: number
      done: number
      failed: number
    }
    agents: {
      total: number
      running: number
      waiting: number
    }
  }> {
    const tasks = config ? await TaskManager.list(config.projectRoot) : []
    const agents = AgentManager.list()

    return {
      running,
      config,
      tasks: {
        total: tasks.length,
        pending: tasks.filter((t) => t.meta.status === "pending").length,
        running: tasks.filter((t) => t.meta.status === "running").length,
        done: tasks.filter((t) => t.meta.status === "done").length,
        failed: tasks.filter((t) => t.meta.status === "failed").length,
      },
      agents: {
        total: agents.length,
        running: agents.filter((a) => a.status === "running").length,
        waiting: agents.filter((a) => a.status === "waiting").length,
      },
    }
  }
}
```

### 3. 使用示例

```typescript
import { HydraCore } from "./hydra"

// 初始化
await HydraCore.init("/path/to/project", {
  maxAgents: 3,
  pollInterval: 5000,
})

// 启动调度器
await HydraCore.start()

// 创建任务（会自动被分配）
const task = await HydraCore.runTask({
  title: "实现用户登录",
  description: "...",
  agentClass: "Coder",
  allow: ["src/auth/**"],
})

// 等待完成
const result = await HydraCore.waitForTask(task.meta.id, 3600000)
console.log("Task completed:", result)

// 停止调度器
await HydraCore.stop()
```

### 4. 主控 AI 集成

```typescript
// Link（主控 AI）可以这样使用：

// 1. 初始化 Hydra
await HydraCore.init(projectRoot)

// 2. 创建多个任务
const tasks = await Promise.all([
  HydraCore.runTask({ title: "实现登录", agentClass: "Coder", ... }),
  HydraCore.runTask({ title: "写文档", agentClass: "Writer", ... }),
  HydraCore.runTask({ title: "代码审查", agentClass: "Reviewer", depends: ["t001"], ... }),
])

// 3. 启动调度器
await HydraCore.start()

// 4. 监听事件
HydraBus.on(HydraEvent.AgentWaiting, async (data) => {
  // Agent 需要帮助，主控介入
  const logs = await AgentManager.logs(data.agentId)
  const response = await thinkAndRespond(logs, data.reason)
  await AgentManager.send(data.agentId, response)
})

// 5. 等待所有任务完成
for (const task of tasks) {
  await HydraCore.waitForTask(task.meta.id)
}

// 6. 获取状态
const status = await HydraCore.getStatus()
console.log(status)
```

## Acceptance Criteria

- [ ] HydraCore.init() 初始化配置和目录
- [ ] HydraCore.start() 启动任务轮询
- [ ] HydraCore.stop() 停止轮询
- [ ] 自动分配 pending 任务给空闲 Agent
- [ ] 尊重 maxAgents 限制
- [ ] 任务依赖正确处理
- [ ] Agent 完成时更新任务状态
- [ ] Agent 失败时标记任务失败
- [ ] HydraCore.runTask() 创建并执行任务
- [ ] HydraCore.waitForTask() 等待任务完成
- [ ] HydraCore.getStatus() 返回正确状态
- [ ] 有单元测试

## Notes

- 这是 Hydra 的核心模块，协调所有组件
- 轮询间隔可配置，默认 5 秒
- 任务分配是先进先出（FIFO）
- 可以后续优化为优先级队列
