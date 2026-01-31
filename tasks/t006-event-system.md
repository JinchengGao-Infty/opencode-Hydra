# Task: 实现 Event 事件系统

## Meta
- id: t006
- status: pending
- priority: P1
- depends: t004
- allow: packages/opencode/src/hydra/**

## Description

实现 Hydra 的事件系统，用于任务和 Agent 状态变化的通知。

### 1. 文件位置

```
packages/opencode/src/hydra/
├── event/
│   ├── index.ts      # 导出
│   ├── events.ts     # 事件定义
│   └── bus.ts        # EventBus 实现
└── index.ts          # 更新导出
```

### 2. 事件定义 (events.ts)

```typescript
import z from "zod"

export namespace HydraEvent {
  // 基础事件结构
  export interface Event<T> {
    type: string
    schema: z.ZodType<T>
  }

  // 定义事件的辅助函数
  export function define<T>(type: string, schema: z.ZodType<T>): Event<T> {
    return { type, schema }
  }

  // ============ 任务事件 ============

  export const TaskCreated = define("hydra.task.created", z.object({
    taskId: z.string(),
    title: z.string(),
  }))

  export const TaskStarted = define("hydra.task.started", z.object({
    taskId: z.string(),
    agentId: z.string(),
  }))

  export const TaskProgress = define("hydra.task.progress", z.object({
    taskId: z.string(),
    agentId: z.string(),
    message: z.string(),
  }))

  export const TaskCompleted = define("hydra.task.completed", z.object({
    taskId: z.string(),
    agentId: z.string(),
    output: z.string(),
    filesChanged: z.array(z.string()),
  }))

  export const TaskFailed = define("hydra.task.failed", z.object({
    taskId: z.string(),
    agentId: z.string().optional(),
    error: z.string(),
  }))

  export const TaskCancelled = define("hydra.task.cancelled", z.object({
    taskId: z.string(),
    reason: z.string().optional(),
  }))

  // ============ Agent 事件 ============

  export const AgentSpawned = define("hydra.agent.spawned", z.object({
    agentId: z.string(),
    class: z.string(),
    name: z.string(),
    worktree: z.string(),
  }))

  export const AgentStarted = define("hydra.agent.started", z.object({
    agentId: z.string(),
    taskId: z.string(),
  }))

  export const AgentPaused = define("hydra.agent.paused", z.object({
    agentId: z.string(),
  }))

  export const AgentResumed = define("hydra.agent.resumed", z.object({
    agentId: z.string(),
  }))

  export const AgentWaiting = define("hydra.agent.waiting", z.object({
    agentId: z.string(),
    taskId: z.string().optional(),
    reason: z.string(),
  }))

  export const AgentMessage = define("hydra.agent.message", z.object({
    agentId: z.string(),
    message: z.string(),
    from: z.enum(["user", "master"]),  // 来自用户还是主控 AI
  }))

  export const AgentCompleted = define("hydra.agent.completed", z.object({
    agentId: z.string(),
    taskId: z.string().optional(),
    output: z.string().optional(),
  }))

  export const AgentFailed = define("hydra.agent.failed", z.object({
    agentId: z.string(),
    taskId: z.string().optional(),
    error: z.string(),
  }))

  export const AgentKilled = define("hydra.agent.killed", z.object({
    agentId: z.string(),
    reason: z.string().optional(),
  }))
}
```

### 3. EventBus 实现 (bus.ts)

```typescript
import { HydraEvent } from "./events"
import z from "zod"

type Handler<T> = (data: T) => void | Promise<void>

export namespace HydraBus {
  // 事件处理器存储
  const handlers = new Map<string, Set<Handler<unknown>>>()

  // 事件历史（可选，用于调试）
  const history: Array<{ type: string; data: unknown; timestamp: Date }> = []
  const MAX_HISTORY = 100

  /**
   * 订阅事件
   * @returns 取消订阅的函数
   */
  export function on<T>(
    event: HydraEvent.Event<T>,
    handler: Handler<T>
  ): () => void {
    const set = handlers.get(event.type) ?? new Set()
    set.add(handler as Handler<unknown>)
    handlers.set(event.type, set)

    // 返回取消订阅函数
    return () => {
      set.delete(handler as Handler<unknown>)
      if (set.size === 0) {
        handlers.delete(event.type)
      }
    }
  }

  /**
   * 发送事件
   */
  export function emit<T>(event: HydraEvent.Event<T>, data: T): void {
    // 验证数据
    const parsed = event.schema.parse(data)

    // 记录历史
    history.push({ type: event.type, data: parsed, timestamp: new Date() })
    if (history.length > MAX_HISTORY) {
      history.shift()
    }

    // 调用处理器
    const set = handlers.get(event.type)
    if (set) {
      for (const handler of set) {
        try {
          const result = handler(parsed)
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error(`[HydraBus] Handler error for ${event.type}:`, err)
            })
          }
        } catch (err) {
          console.error(`[HydraBus] Handler error for ${event.type}:`, err)
        }
      }
    }
  }

  /**
   * 等待事件（返回 Promise）
   * @param filter 可选的过滤函数
   * @param timeout 超时时间（毫秒）
   */
  export function once<T>(
    event: HydraEvent.Event<T>,
    filter?: (data: T) => boolean,
    timeout?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timer: Timer | undefined
      
      const unsubscribe = on(event, (data) => {
        if (!filter || filter(data)) {
          if (timer) clearTimeout(timer)
          unsubscribe()
          resolve(data)
        }
      })

      if (timeout) {
        timer = setTimeout(() => {
          unsubscribe()
          reject(new Error(`Timeout waiting for ${event.type}`))
        }, timeout)
      }
    })
  }

  /**
   * 获取事件历史
   */
  export function getHistory(filter?: {
    type?: string
    limit?: number
  }): Array<{ type: string; data: unknown; timestamp: Date }> {
    let result = [...history]
    
    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type)
    }
    
    if (filter?.limit) {
      result = result.slice(-filter.limit)
    }
    
    return result
  }

  /**
   * 清空事件历史
   */
  export function clearHistory(): void {
    history.length = 0
  }

  /**
   * 获取订阅者数量（调试用）
   */
  export function subscriberCount(event: HydraEvent.Event<unknown>): number {
    return handlers.get(event.type)?.size ?? 0
  }
}
```

### 4. 使用示例

```typescript
import { HydraEvent, HydraBus } from "./event"

// 订阅事件
const unsubscribe = HydraBus.on(HydraEvent.TaskCompleted, (data) => {
  console.log(`任务 ${data.taskId} 完成！`)
  console.log(`修改的文件: ${data.filesChanged.join(", ")}`)
})

// 发送事件
HydraBus.emit(HydraEvent.TaskCompleted, {
  taskId: "t001",
  agentId: "agent-abc",
  output: "实现了登录功能",
  filesChanged: ["src/auth/login.tsx", "src/auth/useAuth.ts"],
})

// 等待事件
const result = await HydraBus.once(
  HydraEvent.TaskCompleted,
  (data) => data.taskId === "t001",
  60000  // 60 秒超时
)

// 取消订阅
unsubscribe()
```

### 5. 集成到 AgentManager

在 AgentManager 中发送事件：

```typescript
// spawn 时
HydraBus.emit(HydraEvent.AgentSpawned, {
  agentId: agent.id,
  class: agent.class,
  name: agent.name,
  worktree: agent.worktree,
})

// start 时
HydraBus.emit(HydraEvent.AgentStarted, {
  agentId: agent.id,
  taskId: task.meta.id,
})

// 完成时
HydraBus.emit(HydraEvent.AgentCompleted, {
  agentId: agent.id,
  taskId: task.meta.id,
  output: result,
})

// 失败时
HydraBus.emit(HydraEvent.AgentFailed, {
  agentId: agent.id,
  taskId: task.meta.id,
  error: error.message,
})
```

## Acceptance Criteria

- [ ] HydraEvent 定义所有任务和 Agent 事件
- [ ] HydraBus.on() 能订阅事件
- [ ] HydraBus.emit() 能发送事件并触发处理器
- [ ] HydraBus.once() 能等待事件（支持过滤和超时）
- [ ] 事件数据经过 Zod 验证
- [ ] 处理器错误不影响其他处理器
- [ ] 事件历史记录正常工作
- [ ] 有单元测试

## Notes

- 事件是同步触发的，但处理器可以是异步的
- 处理器错误会被捕获并打印，不会中断其他处理器
- 事件历史有上限（100 条），防止内存泄漏
- 可以考虑后续支持持久化事件（写入文件）
