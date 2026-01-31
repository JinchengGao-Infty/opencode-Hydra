import { $ } from "bun"
import fs from "fs/promises"
import path from "node:path"
import { Instance } from "../../project/instance"
import { Worktree } from "../../worktree"
import { TaskManager, type Task } from "../task"
import { AgentClass } from "./class"
import { AgentInstance } from "./instance"

export namespace AgentManager {
  const instances = new Map<string, AgentInstance.Info>()
  const processes = new Map<string, Subprocess>()

  export async function spawn(
    projectRoot: string,
    input: {
      class: string
      name?: string
      model?: string
      thinking?: AgentClass.Thinking
      taskId?: string
    },
  ): Promise<AgentInstance.Info> {
    const klass = await AgentClass.get(projectRoot, input.class)
    if (!klass) throw new Error(`AgentManager.spawn: class not found: ${input.class}`)

    const name = input.name ?? input.class
    const model = input.model ?? klass.defaultModel
    const thinking = input.thinking ?? klass.defaultThinking

    const tree = await Instance.provide({
      directory: projectRoot,
      fn: () => Worktree.create({ name }),
    })

    const agent = AgentInstance.create({
      class: input.class,
      name,
      model,
      thinking,
      worktree: tree.directory,
      taskId: input.taskId,
    })

    instances.set(agent.id, agent)
    return agent
  }

  export function list(filter?: { status?: AgentInstance.Status[] }): AgentInstance.Info[] {
    const list = Array.from(instances.values())
    if (!filter?.status?.length) return list
    return list.filter((x) => filter.status?.includes(x.status))
  }

  export function get(id: string): AgentInstance.Info | undefined {
    return instances.get(id)
  }

  export async function start(projectRoot: string, agentId: string): Promise<void> {
    const agent = get(agentId)
    if (!agent) throw new Error(`AgentManager.start: agent not found: ${agentId}`)

    const running = processes.get(agentId)
    if (running) throw new Error(`AgentManager.start: agent already started: ${agentId}`)

    if (!agent.taskId) throw new Error(`AgentManager.start: agent taskId missing: ${agentId}`)

    const task = await TaskManager.get(projectRoot, agent.taskId)
    if (!task) throw new Error(`AgentManager.start: task not found: ${agent.taskId}`)

    const klass = await AgentClass.get(projectRoot, agent.class)
    if (!klass) throw new Error(`AgentManager.start: class not found: ${agent.class}`)

    await fs.mkdir(path.join(agent.worktree, ".hydra"), { recursive: true })
    await ensureLogfile(agent.worktree)

    const prompt = buildPrompt(klass, task, agent.worktree)
    const proc = await startOpenCodeProcess(agentId, agent.worktree, agent.model, agent.thinking, prompt)

    processes.set(agentId, proc)

    const now = new Date().toISOString()
    instances.set(
      agentId,
      AgentInstance.Info.parse({
        ...agent,
        pid: proc.pid,
        status: "running",
        started: agent.started ?? now,
      }),
    )

    void watchProcess(agentId, proc).catch(() => undefined)
  }

  export async function send(agentId: string, message: string): Promise<void> {
    const proc = processes.get(agentId)
    if (!proc) throw new Error(`AgentManager.send: process not found: ${agentId}`)
    if (!proc.stdin) throw new Error(`AgentManager.send: process stdin not available: ${agentId}`)

    const agent = get(agentId)
    if (agent?.status === "waiting") updateStatus(agentId, "running")

    const text = message.endsWith("\n") ? message : message + "\n"
    proc.stdin.write(text)
    proc.stdin.flush()
  }

  export async function pause(agentId: string): Promise<void> {
    const proc = processes.get(agentId)
    if (!proc) throw new Error(`AgentManager.pause: process not found: ${agentId}`)
    proc.kill("SIGSTOP")
    updateStatus(agentId, "paused")
  }

  export async function resume(agentId: string): Promise<void> {
    const proc = processes.get(agentId)
    if (!proc) throw new Error(`AgentManager.resume: process not found: ${agentId}`)
    proc.kill("SIGCONT")
    updateStatus(agentId, "running")
  }

  export async function kill(agentId: string, options?: { cleanup?: boolean }): Promise<void> {
    const agent = get(agentId)
    if (!agent) throw new Error(`AgentManager.kill: agent not found: ${agentId}`)

    const proc = processes.get(agentId)
    const code = await (async () => {
      if (!proc) return
      proc.kill("SIGTERM")
      return proc.exited.catch(() => undefined)
    })()

    if (proc && processes.get(agentId) === proc) processes.delete(agentId)
    if (code !== undefined) updateStatus(agentId, code === 0 ? "done" : "failed")

    const cleanup = options?.cleanup ?? false
    if (!cleanup) return

    await removeWorktree(agent.worktree)
  }

  export async function logs(agentId: string, options?: { lines?: number; follow?: boolean }): Promise<string> {
    const agent = get(agentId)
    if (!agent) throw new Error(`AgentManager.logs: agent not found: ${agentId}`)

    const proc = processes.get(agentId)
    if (options?.follow && proc) await proc.exited.catch(() => undefined)

    const file = logPath(agent.worktree)
    const ok = await Bun.file(file).exists()
    if (!ok) return ""

    const text = await Bun.file(file).text()
    const lines = options?.lines
    if (!lines || lines <= 0) return text

    const parts = text.split("\n")
    return parts.slice(Math.max(0, parts.length - lines)).join("\n")
  }

  export function updateStatus(agentId: string, status: AgentInstance.Status): void {
    const agent = get(agentId)
    if (!agent) throw new Error(`AgentManager.updateStatus: agent not found: ${agentId}`)

    const now = new Date().toISOString()
    const started = status === "running" && !agent.started ? now : agent.started
    const finished = (status === "done" || status === "failed") && !agent.finished ? now : agent.finished

    instances.set(
      agentId,
      AgentInstance.Info.parse({
        ...agent,
        status,
        started,
        finished,
      }),
    )
  }

  export async function cleanup(agentId: string): Promise<void> {
    const agent = get(agentId)
    if (!agent) return
    if (agent.status !== "done" && agent.status !== "failed") return

    const proc = processes.get(agentId)
    if (proc) await kill(agentId, { cleanup: true })

    instances.delete(agentId)
    processes.delete(agentId)
  }
}

function buildPrompt(klass: AgentClass.Info, task: Task.Info, worktree: string): string {
  const allow = task.meta.allow.join(", ") || "所有文件"

  return [
    klass.prompt,
    "",
    "---",
    "",
    "# 当前任务",
    "",
    task.title,
    "",
    "## 任务描述",
    "",
    task.description,
    "",
    "## 允许修改的文件",
    "",
    allow,
    "",
    "## 工作目录",
    "",
    worktree,
    "",
    "## 重要提示",
    "",
    "1. 在 .hydra/agent-log.md 中记录你的工作进度",
    '2. 遇到困难时，在日志中标记 "⚠️ 等待输入" 并说明问题',
    '3. 完成后在日志中标记 "✅ 完成" 并总结所做的更改',
    "4. 不要修改 allow 列表之外的文件",
    "",
  ].join("\n")
}

function logPath(worktree: string) {
  return path.join(worktree, ".hydra/agent-log.md")
}

async function ensureLogfile(worktree: string) {
  const file = logPath(worktree)
  const ok = await Bun.file(file).exists()
  if (ok) return
  await Bun.write(file, "")
}

async function startOpenCodeProcess(
  agentId: string,
  worktree: string,
  model: string,
  thinking: string,
  prompt: string,
): Promise<Subprocess> {
  const bin = process.env["HYDRA_OPENCODE_BIN"]?.trim() || Bun.which("opencode")
  if (!bin) throw new Error("AgentManager.start: opencode binary not found in PATH")

  const proc = Bun.spawn(
    [bin, "run", "--unattended", "--model", model, "--variant", thinking, prompt],
    {
      cwd: worktree,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HYDRA_AGENT_ID: agentId,
      },
    },
  )

  return proc
}

async function watchProcess(agentId: string, proc: Subprocess): Promise<void> {
  const agent = AgentManager.get(agentId)
  if (!agent) return

  await ensureLogfile(agent.worktree)
  const file = logPath(agent.worktree)
  const decoder = new TextDecoder()

  const update = (text: string) => {
    if (text.includes("WAITING") || text.includes("⚠️")) AgentManager.updateStatus(agentId, "waiting")
    if (text.includes("DONE") || text.includes("✅")) AgentManager.updateStatus(agentId, "done")
    if (text.includes("FAILED")) AgentManager.updateStatus(agentId, "failed")
  }

  const pump = async (stream: ReadableStream<Uint8Array> | null) => {
    if (!stream) return
    for await (const chunk of stream) {
      const text = decoder.decode(chunk)
      await fs.appendFile(file, text)
      update(text)
    }
  }

  const out = pump(proc.stdout)
  const err = pump(proc.stderr)
  const code = await proc.exited.catch(() => undefined)
  await Promise.all([out, err])

  if (AgentManager.get(agentId)?.pid === proc.pid) {
    if (code !== undefined) AgentManager.updateStatus(agentId, code === 0 ? "done" : "failed")
  }
}

async function removeWorktree(worktree: string) {
  const common = await $`git rev-parse --git-common-dir`.quiet().nothrow().cwd(worktree)
  const text = common.exitCode === 0 ? new TextDecoder().decode(common.stdout ?? new Uint8Array()).trim() : ""
  const dir = text ? path.resolve(worktree, text) : worktree
  const root = text ? path.dirname(dir) : worktree

  const removed = await Instance.provide({
    directory: root,
    fn: () => Worktree.remove({ directory: worktree }),
  }).catch(() => false)

  if (removed) return
  await fs.rm(worktree, { recursive: true, force: true })
}
