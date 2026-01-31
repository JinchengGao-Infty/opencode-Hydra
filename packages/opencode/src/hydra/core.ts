import { AgentClass, AgentManager } from "./agent"
import { HydraBus, HydraEvent } from "./event"
import { TaskManager, type Task } from "./task"
import { HydraConfig } from "./config"

export namespace HydraCore {
  export interface Config {
    projectRoot: string
    maxAgents: number
    pollInterval: number
    defaultTimeout: number
  }

  const DEFAULT: Omit<Config, "projectRoot"> = {
    maxAgents: 3,
    pollInterval: 5000,
    defaultTimeout: 3600,
  }

  let config: Config | undefined
  let running = false
  let poll: ReturnType<typeof setInterval> | undefined
  let busy = false
  let subs: Array<() => void> = []

  export async function init(projectRoot: string, options?: Partial<Config>): Promise<void> {
    await stop()

    const loaded = HydraConfig.load(projectRoot)
    AgentClass.register(loaded.classes, loaded.defaults)

    config = {
      projectRoot,
      maxAgents: options?.maxAgents ?? loaded.defaults.maxAgents ?? DEFAULT.maxAgents,
      pollInterval: options?.pollInterval ?? DEFAULT.pollInterval,
      defaultTimeout: options?.defaultTimeout ?? loaded.defaults.timeout ?? DEFAULT.defaultTimeout,
    }

    await TaskManager.init(projectRoot)
    setup()

    if (loaded.scheduler.autoStart) await start()
  }

  export async function start(): Promise<void> {
    const cfg = config
    if (!cfg) throw new Error("HydraCore.start: not initialized")
    if (running) return

    running = true
    poll = setInterval(() => void pollTasks(), cfg.pollInterval)
    await pollTasks()
  }

  export async function stop(): Promise<void> {
    running = false

    const timer = poll
    if (timer) clearInterval(timer)
    poll = undefined
  }

  export async function reset(): Promise<void> {
    await stop()

    for (const fn of subs) fn()
    subs = []

    config = undefined
    busy = false
  }

  export async function runTask(input: {
    title: string
    description: string
    agentClass?: string
    model?: string
    thinking?: "low" | "medium" | "high"
    allow?: string[]
    timeout?: number
    depends?: string[]
  }): Promise<Task.Info> {
    const cfg = config
    if (!cfg) throw new Error("HydraCore.runTask: not initialized")

    const task = await TaskManager.create(cfg.projectRoot, {
      ...input,
      timeout: input.timeout ?? cfg.defaultTimeout,
    })

    HydraBus.emit(HydraEvent.TaskCreated, {
      taskId: task.meta.id,
      title: task.title,
    })

    if (!running) {
      await assignTask(task)
      return task
    }

    await pollTasks()
    return task
  }

  export async function waitForTask(taskId: string, timeout?: number): Promise<Task.Info> {
    const cfg = config
    if (!cfg) throw new Error("HydraCore.waitForTask: not initialized")

    const current = await TaskManager.get(cfg.projectRoot, taskId)
    if (!current) throw new Error(`HydraCore.waitForTask: task not found: ${taskId}`)
    if (current.meta.status === "done") return current
    if (current.meta.status === "failed") return current
    if (current.meta.status === "cancelled") return current

    const ms = timeout ?? cfg.defaultTimeout * 1000

    await new Promise<void>((resolve, reject) => {
      const state: {
        done: boolean
        a?: () => void
        b?: () => void
        timer?: ReturnType<typeof setTimeout>
      } = { done: false }

      const finish = (err?: Error) => {
        if (state.done) return
        state.done = true
        if (state.timer) clearTimeout(state.timer)
        if (state.a) state.a()
        if (state.b) state.b()
        if (err) reject(err)
        if (!err) resolve()
      }

      state.a = HydraBus.on(HydraEvent.TaskCompleted, (data) => {
        if (data.taskId !== taskId) return
        finish()
      })

      state.b = HydraBus.on(HydraEvent.TaskFailed, (data) => {
        if (data.taskId !== taskId) return
        finish()
      })

      state.timer = ms
        ? setTimeout(() => finish(new Error(`HydraCore.waitForTask: timeout for ${taskId}`)), ms)
        : undefined
    })

    const task = await TaskManager.get(cfg.projectRoot, taskId)
    if (!task) throw new Error(`HydraCore.waitForTask: task not found: ${taskId}`)
    return task
  }

  export async function getStatus(): Promise<{
    running: boolean
    config: Config | undefined
    tasks: {
      total: number
      pending: number
      running: number
      done: number
      failed: number
      cancelled: number
    }
    agents: {
      total: number
      running: number
      waiting: number
      paused: number
    }
  }> {
    const cfg = config
    const tasks = cfg ? await TaskManager.list(cfg.projectRoot) : []
    const agents = AgentManager.list()

    return {
      running,
      config: cfg,
      tasks: {
        total: tasks.length,
        pending: tasks.filter((t) => t.meta.status === "pending").length,
        running: tasks.filter((t) => t.meta.status === "running").length,
        done: tasks.filter((t) => t.meta.status === "done").length,
        failed: tasks.filter((t) => t.meta.status === "failed").length,
        cancelled: tasks.filter((t) => t.meta.status === "cancelled").length,
      },
      agents: {
        total: agents.length,
        running: agents.filter((a) => a.status === "running").length,
        waiting: agents.filter((a) => a.status === "waiting").length,
        paused: agents.filter((a) => a.status === "paused").length,
      },
    }
  }

  async function pollTasks(): Promise<void> {
    const cfg = config
    if (!cfg) return
    if (!running) return
    if (busy) return

    busy = true
    try {
      const ready = await TaskManager.getReady(cfg.projectRoot)
      if (ready.length === 0) return

      const list = AgentManager.list({ status: ["running", "waiting", "paused"] })
      const slots = cfg.maxAgents - list.length
      if (slots <= 0) return

      for (const task of ready.slice(0, slots)) await assignTask(task)
    } finally {
      busy = false
    }
  }

  async function assignTask(task: Task.Info): Promise<void> {
    const cfg = config
    if (!cfg) return

    try {
      const name = task.meta.agentClass ?? "Coder"
      const klass = await AgentClass.get(cfg.projectRoot, name)
      if (!klass) throw new Error(`HydraCore.assignTask: agent class not found: ${name}`)

      const agent = await AgentManager.spawn(cfg.projectRoot, {
        class: name,
        name: `${name.toLowerCase()}-${task.meta.id}`,
        model: task.meta.model ?? klass.defaultModel,
        thinking: task.meta.thinking ?? klass.defaultThinking,
        taskId: task.meta.id,
      })

      await TaskManager.updateStatus(cfg.projectRoot, task.meta.id, "running")

      HydraBus.emit(HydraEvent.TaskStarted, {
        taskId: task.meta.id,
        agentId: agent.id,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)

      await TaskManager.updateStatus(cfg.projectRoot, task.meta.id, "failed")
      HydraBus.emit(HydraEvent.TaskFailed, {
        taskId: task.meta.id,
        error: msg,
      })
    }
  }

  function setup(): void {
    for (const fn of subs) fn()
    subs = []

    subs.push(
      HydraBus.on(HydraEvent.AgentCompleted, async (data) => {
        const cfg = config
        if (!cfg) return
        if (!data.taskId) return

        const logs = await AgentManager.logs(data.agentId)
        const output = extractOutput(logs)
        const filesChanged = extractFilesChanged(logs)

        await TaskManager.updateOutput(cfg.projectRoot, data.taskId, output, filesChanged)
        await TaskManager.updateStatus(cfg.projectRoot, data.taskId, "done")

        HydraBus.emit(HydraEvent.TaskCompleted, {
          taskId: data.taskId,
          agentId: data.agentId,
          output,
          filesChanged,
        })

        await AgentManager.cleanup(data.agentId)
      }),
    )

    subs.push(
      HydraBus.on(HydraEvent.AgentFailed, async (data) => {
        const cfg = config
        if (!cfg) return
        if (!data.taskId) return

        await TaskManager.updateStatus(cfg.projectRoot, data.taskId, "failed")

        HydraBus.emit(HydraEvent.TaskFailed, {
          taskId: data.taskId,
          agentId: data.agentId,
          error: data.error,
        })

        await AgentManager.cleanup(data.agentId)
      }),
    )
  }

  function extractOutput(logs: string): string {
    const match = logs.match(/✅ 完成[\s\S]*?\*\*总结\*\*:\s*([\s\S]*?)(?=\*\*修改的文件|$)/i)
    return match?.[1]?.trim() || ""
  }

  function extractFilesChanged(logs: string): string[] {
    const match = logs.match(/\*\*修改的文件\*\*:\s*([\s\S]*?)(?=\n\n|$)/i)
    if (!match) return []

    return match[1]
      .split("\n")
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter(Boolean)
  }
}
