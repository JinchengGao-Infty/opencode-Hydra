# Task: 事件通知机制

## Meta
- id: t017
- status: pending
- priority: P1
- depends: t012
- allow: packages/opencode/src/hydra/**, packages/opencode/src/mcp/**

## Description

实现子 AI 事件的**主动推送**机制，让主控 AI 能被动收到通知。

### 背景

当前主控 AI（Link/OpenClaw）通过 MCP 调度子 AI 后，只能通过轮询来检查状态。需要一个**非阻塞**的推送机制。

### 需求

#### 1. Webhook 回调机制

在 spawn Agent 时注册回调 URL：

```typescript
server.registerTool("hydra_agent_spawn", {
  inputSchema: z.object({
    class: z.string(),
    task: z.string().optional(),
    // 新增：回调配置
    callback: z.object({
      url: z.string(),           // 回调 URL
      events: z.array(z.enum([   // 订阅的事件
        "completed", "failed", "waiting"
      ])).default(["completed", "failed"]),
      headers: z.record(z.string()).optional(), // 自定义 headers
    }).optional(),
  }),
})
```

**使用示例**：
```typescript
hydra_agent_spawn({
  class: "Coder",
  task: "t001",
  callback: {
    url: "http://localhost:18789/api/webhook/hydra",
    events: ["completed", "failed", "waiting"],
    headers: { "X-Session-Key": "main" }
  }
})
```

当事件发生时，Hydra POST 到回调 URL：
```json
{
  "event": "agent.completed",
  "agentId": "agent-xxx",
  "taskId": "t001",
  "timestamp": "2026-02-01T10:30:00Z",
  "data": {
    "output": "完成了重构...",
    "filesChanged": ["src/auth.ts", "src/db.ts"]
  }
}
```

#### 2. OpenClaw 集成

OpenClaw Gateway 提供 webhook 端点，收到回调后触发 wake event：

```
POST /api/webhook/hydra
→ 解析事件
→ 触发 wake event
→ Link 收到通知
```

#### 3. 命令行回调（备选）

如果 webhook 不可用，支持执行命令：

```typescript
callback: {
  command: "openclaw gateway wake --text 'Agent {agentId} {event}' --mode now"
}
```

Hydra 在事件发生时执行命令，替换 `{agentId}`, `{event}`, `{taskId}` 等变量。

### 技术实现

#### 1. CallbackManager

```typescript
export namespace CallbackManager {
  interface Callback {
    agentId: string
    url?: string
    command?: string
    events: string[]
    headers?: Record<string, string>
  }
  
  const callbacks = new Map<string, Callback>()
  
  export function register(agentId: string, config: Callback): void
  export function unregister(agentId: string): void
  
  // 在 HydraBus 事件触发时调用
  export async function notify(event: string, data: unknown): Promise<void>
}
```

#### 2. 事件监听

```typescript
// 在 HydraCore.init() 中注册
HydraBus.on(HydraEvent.AgentCompleted, (data) => {
  CallbackManager.notify("completed", data)
})

HydraBus.on(HydraEvent.AgentFailed, (data) => {
  CallbackManager.notify("failed", data)
})

HydraBus.on(HydraEvent.AgentWaiting, (data) => {
  CallbackManager.notify("waiting", data)
})
```

#### 3. HTTP 回调

```typescript
async function notifyHttp(url: string, headers: Record<string, string>, payload: unknown) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  })
}
```

#### 4. 命令回调

```typescript
async function notifyCommand(command: string, data: Record<string, string>) {
  const cmd = command
    .replace("{agentId}", data.agentId)
    .replace("{taskId}", data.taskId)
    .replace("{event}", data.event)
  await $`sh -c ${cmd}`
}
```

## Acceptance Criteria

- [ ] `hydra_agent_spawn` 支持 `callback` 参数
- [ ] 支持 HTTP webhook 回调
- [ ] 支持命令行回调
- [ ] Agent 完成时触发回调
- [ ] Agent 失败时触发回调
- [ ] Agent 等待输入时触发回调
- [ ] 回调失败不影响主流程（静默失败或重试）

## 测试用例

```typescript
// 1. HTTP 回调
const server = Bun.serve({ port: 9999, fetch: (req) => { ... } })
await hydra_agent_spawn({
  class: "Coder",
  task: "t001",
  callback: { url: "http://localhost:9999/hook", events: ["completed"] }
})
// 等待 Agent 完成，验证 server 收到请求

// 2. 命令回调
await hydra_agent_spawn({
  class: "Coder", 
  task: "t001",
  callback: { command: "echo '{event} {agentId}' >> /tmp/events.log" }
})
// 验证 /tmp/events.log 有内容
```
