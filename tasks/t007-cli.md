# Task: 实现 Hydra CLI 命令

## Meta
- id: t007
- status: pending
- priority: P2
- depends: t002, t004, t005, t006
- allow: packages/opencode/src/hydra/**, packages/opencode/src/cli/**

## Description

实现 Hydra 的 CLI 命令，让用户可以通过命令行管理任务和 Agent。

### 1. 文件位置

```
packages/opencode/src/
├── hydra/
│   └── cli/
│       ├── index.ts      # CLI 入口
│       ├── task.ts       # task 子命令
│       ├── agent.ts      # agent 子命令
│       ├── status.ts     # status 命令
│       └── format.ts     # 输出格式化
└── cli/
    └── index.ts          # 修改，添加 hydra 子命令
```

### 2. 注册 hydra 子命令

修改 `packages/opencode/src/cli/index.ts`，添加 hydra 命令：

```typescript
import { HydraCLI } from "../hydra/cli"

// 在 yargs 配置中添加
.command("hydra", "Multi-agent orchestration system", HydraCLI.register)
```

### 3. CLI 入口 (hydra/cli/index.ts)

```typescript
import type { Argv } from "yargs"
import { TaskCommands } from "./task"
import { AgentCommands } from "./agent"
import { StatusCommand } from "./status"

export namespace HydraCLI {
  export function register(yargs: Argv) {
    return yargs
      .command("task", "Manage tasks", TaskCommands.register)
      .command("agent", "Manage agents", AgentCommands.register)
      .command("status", "Show overall status", StatusCommand.handler)
      .demandCommand(1, "Please specify a command")
  }
}
```

### 4. Task 命令 (hydra/cli/task.ts)

```typescript
import type { Argv } from "yargs"
import { TaskManager } from "../task/manager"
import { Format } from "./format"

export namespace TaskCommands {
  export function register(yargs: Argv) {
    return yargs
      .command(
        "create <title>",
        "Create a new task",
        (yargs) => yargs
          .positional("title", { type: "string", demandOption: true })
          .option("description", { alias: "d", type: "string", default: "" })
          .option("class", { alias: "c", type: "string", description: "Agent class" })
          .option("model", { alias: "m", type: "string" })
          .option("thinking", { type: "string", choices: ["low", "medium", "high"] })
          .option("allow", { type: "array", string: true, default: [] })
          .option("timeout", { type: "number" })
          .option("depends", { type: "array", string: true, default: [] }),
        handleCreate
      )
      .command(
        "list",
        "List all tasks",
        (yargs) => yargs
          .option("status", { alias: "s", type: "array", string: true })
          .option("json", { type: "boolean", default: false }),
        handleList
      )
      .command(
        "show <id>",
        "Show task details",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true })
          .option("json", { type: "boolean", default: false }),
        handleShow
      )
      .command(
        "cancel <id>",
        "Cancel a task",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true }),
        handleCancel
      )
      .demandCommand(1)
  }

  async function handleCreate(args: {
    title: string
    description: string
    class?: string
    model?: string
    thinking?: string
    allow: string[]
    timeout?: number
    depends: string[]
  }) {
    const projectRoot = process.cwd()
    const task = await TaskManager.create(projectRoot, {
      title: args.title,
      description: args.description,
      agentClass: args.class,
      model: args.model,
      thinking: args.thinking as any,
      allow: args.allow,
      timeout: args.timeout,
      depends: args.depends,
    })
    console.log(Format.taskCreated(task))
  }

  async function handleList(args: { status?: string[]; json: boolean }) {
    const projectRoot = process.cwd()
    const tasks = await TaskManager.list(projectRoot, {
      status: args.status as any,
    })
    
    if (args.json) {
      console.log(JSON.stringify(tasks, null, 2))
    } else {
      console.log(Format.taskList(tasks))
    }
  }

  async function handleShow(args: { id: string; json: boolean }) {
    const projectRoot = process.cwd()
    const task = await TaskManager.get(projectRoot, args.id)
    
    if (!task) {
      console.error(`Task not found: ${args.id}`)
      process.exit(1)
    }
    
    if (args.json) {
      console.log(JSON.stringify(task, null, 2))
    } else {
      console.log(Format.taskDetail(task))
    }
  }

  async function handleCancel(args: { id: string }) {
    const projectRoot = process.cwd()
    const task = await TaskManager.cancel(projectRoot, args.id)
    console.log(Format.taskCancelled(task))
  }
}
```

### 5. Agent 命令 (hydra/cli/agent.ts)

```typescript
import type { Argv } from "yargs"
import { AgentManager } from "../agent/manager"
import { AgentClass } from "../agent/class"
import { Format } from "./format"

export namespace AgentCommands {
  export function register(yargs: Argv) {
    return yargs
      .command(
        "spawn <class>",
        "Spawn a new agent",
        (yargs) => yargs
          .positional("class", { type: "string", demandOption: true })
          .option("name", { alias: "n", type: "string" })
          .option("model", { alias: "m", type: "string" })
          .option("thinking", { type: "string", choices: ["low", "medium", "high"] })
          .option("task", { alias: "t", type: "string", description: "Task ID to assign" }),
        handleSpawn
      )
      .command(
        "list",
        "List all agents",
        (yargs) => yargs
          .option("status", { alias: "s", type: "array", string: true })
          .option("json", { type: "boolean", default: false }),
        handleList
      )
      .command(
        "show <id>",
        "Show agent details",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true })
          .option("json", { type: "boolean", default: false }),
        handleShow
      )
      .command(
        "logs <id>",
        "View agent logs",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true })
          .option("follow", { alias: "f", type: "boolean", default: false })
          .option("lines", { alias: "n", type: "number" }),
        handleLogs
      )
      .command(
        "send <id> <message>",
        "Send message to agent",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true })
          .positional("message", { type: "string", demandOption: true }),
        handleSend
      )
      .command(
        "pause <id>",
        "Pause an agent",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true }),
        handlePause
      )
      .command(
        "resume <id>",
        "Resume a paused agent",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true }),
        handleResume
      )
      .command(
        "kill <id>",
        "Kill an agent",
        (yargs) => yargs
          .positional("id", { type: "string", demandOption: true })
          .option("cleanup", { type: "boolean", default: false, description: "Remove worktree" }),
        handleKill
      )
      .command(
        "classes",
        "List available agent classes",
        (yargs) => yargs
          .option("json", { type: "boolean", default: false }),
        handleClasses
      )
      .demandCommand(1)
  }

  async function handleSpawn(args: {
    class: string
    name?: string
    model?: string
    thinking?: string
    task?: string
  }) {
    const projectRoot = process.cwd()
    const agent = await AgentManager.spawn(projectRoot, {
      class: args.class,
      name: args.name,
      model: args.model,
      thinking: args.thinking as any,
      taskId: args.task,
    })
    console.log(Format.agentSpawned(agent))
  }

  async function handleList(args: { status?: string[]; json: boolean }) {
    const agents = AgentManager.list({
      status: args.status as any,
    })
    
    if (args.json) {
      console.log(JSON.stringify(agents, null, 2))
    } else {
      console.log(Format.agentList(agents))
    }
  }

  async function handleShow(args: { id: string; json: boolean }) {
    const agent = AgentManager.get(args.id)
    
    if (!agent) {
      console.error(`Agent not found: ${args.id}`)
      process.exit(1)
    }
    
    if (args.json) {
      console.log(JSON.stringify(agent, null, 2))
    } else {
      console.log(Format.agentDetail(agent))
    }
  }

  async function handleLogs(args: { id: string; follow: boolean; lines?: number }) {
    const logs = await AgentManager.logs(args.id, {
      follow: args.follow,
      lines: args.lines,
    })
    console.log(logs)
  }

  async function handleSend(args: { id: string; message: string }) {
    await AgentManager.send(args.id, args.message)
    console.log(`Message sent to agent ${args.id}`)
  }

  async function handlePause(args: { id: string }) {
    await AgentManager.pause(args.id)
    console.log(`Agent ${args.id} paused`)
  }

  async function handleResume(args: { id: string }) {
    await AgentManager.resume(args.id)
    console.log(`Agent ${args.id} resumed`)
  }

  async function handleKill(args: { id: string; cleanup: boolean }) {
    await AgentManager.kill(args.id, { cleanup: args.cleanup })
    console.log(`Agent ${args.id} killed`)
  }

  async function handleClasses(args: { json: boolean }) {
    const projectRoot = process.cwd()
    const classes = await AgentClass.list(projectRoot)
    
    if (args.json) {
      console.log(JSON.stringify(classes, null, 2))
    } else {
      console.log(Format.classList(classes))
    }
  }
}
```

### 6. Status 命令 (hydra/cli/status.ts)

```typescript
import { TaskManager } from "../task/manager"
import { AgentManager } from "../agent/manager"
import { Format } from "./format"

export namespace StatusCommand {
  export async function handler() {
    const projectRoot = process.cwd()
    
    const tasks = await TaskManager.list(projectRoot)
    const agents = AgentManager.list()
    
    console.log(Format.status(tasks, agents))
  }
}
```

### 7. 输出格式化 (hydra/cli/format.ts)

```typescript
import { Task } from "../task/task"
import { AgentInstance } from "../agent/instance"
import { AgentClass } from "../agent/class"

export namespace Format {
  // 状态颜色
  const STATUS_COLORS: Record<string, string> = {
    pending: "\x1b[33m",   // 黄色
    running: "\x1b[36m",   // 青色
    paused: "\x1b[35m",    // 紫色
    waiting: "\x1b[35m",   // 紫色
    done: "\x1b[32m",      // 绿色
    failed: "\x1b[31m",    // 红色
    cancelled: "\x1b[90m", // 灰色
  }
  const RESET = "\x1b[0m"

  function colorStatus(status: string): string {
    const color = STATUS_COLORS[status] || ""
    return `${color}${status}${RESET}`
  }

  export function taskCreated(task: Task.Info): string {
    return `✅ Task created: ${task.meta.id}
   Title: ${task.title}
   Status: ${colorStatus(task.meta.status)}`
  }

  export function taskList(tasks: Task.Info[]): string {
    if (tasks.length === 0) {
      return "No tasks found."
    }

    const header = "ID          STATUS      TITLE"
    const separator = "─".repeat(60)
    const rows = tasks.map((t) => {
      const id = t.meta.id.padEnd(12)
      const status = colorStatus(t.meta.status).padEnd(20)
      const title = t.title.slice(0, 30)
      return `${id}${status}${title}`
    })

    return [header, separator, ...rows].join("\n")
  }

  export function taskDetail(task: Task.Info): string {
    return `# Task: ${task.meta.id}

**Title:** ${task.title}
**Status:** ${colorStatus(task.meta.status)}
**Class:** ${task.meta.agentClass || "-"}
**Model:** ${task.meta.model || "-"}
**Allow:** ${task.meta.allow.join(", ") || "*"}
**Created:** ${task.meta.created}
${task.meta.started ? `**Started:** ${task.meta.started}` : ""}
${task.meta.finished ? `**Finished:** ${task.meta.finished}` : ""}

## Description
${task.description}
${task.output ? `\n## Output\n${task.output}` : ""}`
  }

  export function taskCancelled(task: Task.Info): string {
    return `❌ Task cancelled: ${task.meta.id}`
  }

  export function agentSpawned(agent: AgentInstance.Info): string {
    return `✅ Agent spawned: ${agent.id}
   Name: ${agent.name}
   Class: ${agent.class}
   Model: ${agent.model}
   Worktree: ${agent.worktree}`
  }

  export function agentList(agents: AgentInstance.Info[]): string {
    if (agents.length === 0) {
      return "No agents running."
    }

    const header = "ID              NAME            CLASS       STATUS      TASK"
    const separator = "─".repeat(80)
    const rows = agents.map((a) => {
      const id = a.id.slice(0, 14).padEnd(16)
      const name = a.name.slice(0, 14).padEnd(16)
      const cls = a.class.padEnd(12)
      const status = colorStatus(a.status).padEnd(20)
      const task = a.taskId || "-"
      return `${id}${name}${cls}${status}${task}`
    })

    return [header, separator, ...rows].join("\n")
  }

  export function agentDetail(agent: AgentInstance.Info): string {
    return `# Agent: ${agent.id}

**Name:** ${agent.name}
**Class:** ${agent.class}
**Status:** ${colorStatus(agent.status)}
**Model:** ${agent.model}
**Thinking:** ${agent.thinking}
**Worktree:** ${agent.worktree}
**Task:** ${agent.taskId || "-"}
**Created:** ${agent.created}
${agent.started ? `**Started:** ${agent.started}` : ""}
${agent.finished ? `**Finished:** ${agent.finished}` : ""}`
  }

  export function classList(classes: AgentClass.Info[]): string {
    const header = "NAME            MODEL                       THINKING    DESCRIPTION"
    const separator = "─".repeat(90)
    const rows = classes.map((c) => {
      const name = c.name.padEnd(16)
      const model = c.defaultModel.padEnd(28)
      const thinking = c.defaultThinking.padEnd(12)
      const desc = c.description.slice(0, 30)
      return `${name}${model}${thinking}${desc}`
    })

    return [header, separator, ...rows].join("\n")
  }

  export function status(tasks: Task.Info[], agents: AgentInstance.Info[]): string {
    const taskStats = {
      total: tasks.length,
      pending: tasks.filter((t) => t.meta.status === "pending").length,
      running: tasks.filter((t) => t.meta.status === "running").length,
      done: tasks.filter((t) => t.meta.status === "done").length,
      failed: tasks.filter((t) => t.meta.status === "failed").length,
    }

    const agentStats = {
      total: agents.length,
      running: agents.filter((a) => a.status === "running").length,
      waiting: agents.filter((a) => a.status === "waiting").length,
      paused: agents.filter((a) => a.status === "paused").length,
    }

    return `
╔══════════════════════════════════════════════════════════════╗
║                      HYDRA STATUS                            ║
╠══════════════════════════════════════════════════════════════╣
║  TASKS                                                       ║
║    Total: ${String(taskStats.total).padEnd(5)} Pending: ${String(taskStats.pending).padEnd(5)} Running: ${String(taskStats.running).padEnd(5)}     ║
║    Done: ${String(taskStats.done).padEnd(6)} Failed: ${String(taskStats.failed).padEnd(5)}                          ║
╠══════════════════════════════════════════════════════════════╣
║  AGENTS                                                      ║
║    Total: ${String(agentStats.total).padEnd(5)} Running: ${String(agentStats.running).padEnd(5)} Waiting: ${String(agentStats.waiting).padEnd(5)}     ║
║    Paused: ${String(agentStats.paused).padEnd(5)}                                            ║
╚══════════════════════════════════════════════════════════════╝
`
  }
}
```

## Acceptance Criteria

- [ ] `opencode hydra task create` 创建任务
- [ ] `opencode hydra task list` 列出任务
- [ ] `opencode hydra task show <id>` 显示任务详情
- [ ] `opencode hydra task cancel <id>` 取消任务
- [ ] `opencode hydra agent spawn <class>` 实例化 Agent
- [ ] `opencode hydra agent list` 列出 Agent
- [ ] `opencode hydra agent logs <id>` 查看日志
- [ ] `opencode hydra agent send <id> <message>` 发送消息
- [ ] `opencode hydra agent pause/resume/kill` 控制 Agent
- [ ] `opencode hydra agent classes` 列出可用类
- [ ] `opencode hydra status` 显示总体状态
- [ ] 支持 `--json` 输出 JSON 格式
- [ ] 输出格式美观，状态有颜色
- [ ] 有基本的错误处理

## Notes

- 使用 yargs 的子命令模式
- 颜色输出使用 ANSI 转义码
- JSON 输出方便脚本调用
- 错误时 exit code 非 0
