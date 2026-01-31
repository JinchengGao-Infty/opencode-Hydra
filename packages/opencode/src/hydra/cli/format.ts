import type { AgentClass } from "../agent/class"
import type { AgentInstance } from "../agent/instance"
import type { Task } from "../task/task"

export namespace Format {
  const colors: Record<string, string> = {
    pending: "\x1b[33m",
    running: "\x1b[36m",
    paused: "\x1b[35m",
    waiting: "\x1b[35m",
    done: "\x1b[32m",
    failed: "\x1b[31m",
    cancelled: "\x1b[90m",
    idle: "\x1b[90m",
  }
  const reset = "\x1b[0m"

  function status(input: string): string {
    const color = colors[input] ?? ""
    if (!color) return input
    return `${color}${input}${reset}`
  }

  function cell(input: string, width: number): string {
    return input.padEnd(width)
  }

  export function taskCreated(task: Task.Info): string {
    return [
      `✅ Task created: ${task.meta.id}`,
      `   Title: ${task.title}`,
      `   Status: ${status(task.meta.status)}`,
    ].join("\n")
  }

  export function taskCancelled(task: Task.Info): string {
    return `❌ Task cancelled: ${task.meta.id}`
  }

  export function taskList(tasks: Task.Info[]): string {
    if (tasks.length === 0) return "No tasks found."

    const header = `${cell("ID", 14)}${cell("STATUS", 12)}TITLE`
    const rule = "─".repeat(60)
    const rows = tasks.map((task) => {
      const id = cell(task.meta.id, 14)
      const st = status(cell(task.meta.status, 12))
      const title = task.title.length > 40 ? task.title.slice(0, 37) + "..." : task.title
      return `${id}${st}${title}`
    })

    return [header, rule, ...rows].join("\n")
  }

  export function taskDetail(task: Task.Info): string {
    const allow = task.meta.allow.join(", ") || "*"
    const started = task.meta.started ? `**Started:** ${task.meta.started}` : ""
    const finished = task.meta.finished ? `**Finished:** ${task.meta.finished}` : ""
    const output = task.output ? `\n## Output\n${task.output}` : ""

    const lines = [
      `# Task: ${task.meta.id}`,
      "",
      `**Title:** ${task.title}`,
      `**Status:** ${status(task.meta.status)}`,
      `**Class:** ${task.meta.agentClass || "-"}`,
      `**Model:** ${task.meta.model || "-"}`,
      `**Allow:** ${allow}`,
      `**Created:** ${task.meta.created}`,
      started,
      finished,
      "",
      "## Description",
      task.description,
    ]

    return lines.filter((line) => Boolean(line)).join("\n") + output
  }

  export function agentSpawned(agent: AgentInstance.Info): string {
    return [
      `✅ Agent spawned: ${agent.id}`,
      `   Name: ${agent.name}`,
      `   Class: ${agent.class}`,
      `   Model: ${agent.model}`,
      `   Worktree: ${agent.worktree}`,
    ].join("\n")
  }

  export function agentList(agents: AgentInstance.Info[]): string {
    if (agents.length === 0) return "No agents running."

    const header = `${cell("ID", 18)}${cell("NAME", 16)}${cell("CLASS", 12)}${cell("STATUS", 12)}TASK`
    const rule = "─".repeat(80)
    const rows = agents.map((agent) => {
      const id = cell(agent.id.slice(0, 16), 18)
      const name = cell(agent.name.slice(0, 14), 16)
      const cls = cell(agent.class, 12)
      const st = status(cell(agent.status, 12))
      const task = agent.taskId ?? "-"
      return `${id}${name}${cls}${st}${task}`
    })

    return [header, rule, ...rows].join("\n")
  }

  export function agentDetail(agent: AgentInstance.Info): string {
    const started = agent.started ? `**Started:** ${agent.started}` : ""
    const finished = agent.finished ? `**Finished:** ${agent.finished}` : ""

    const lines = [
      `# Agent: ${agent.id}`,
      "",
      `**Name:** ${agent.name}`,
      `**Class:** ${agent.class}`,
      `**Status:** ${status(agent.status)}`,
      `**Model:** ${agent.model}`,
      `**Thinking:** ${agent.thinking}`,
      `**Worktree:** ${agent.worktree}`,
      `**Task:** ${agent.taskId || "-"}`,
      `**Created:** ${agent.created}`,
      started,
      finished,
    ]

    return lines.filter((line) => Boolean(line)).join("\n")
  }

  export function classList(classes: AgentClass.Info[]): string {
    const header = `${cell("NAME", 16)}${cell("MODEL", 28)}${cell("THINKING", 12)}DESCRIPTION`
    const rule = "─".repeat(90)
    const rows = classes.map((cls) => {
      const name = cell(cls.name, 16)
      const model = cell(cls.defaultModel, 28)
      const thinking = cell(cls.defaultThinking, 12)
      const desc = cls.description.length > 40 ? cls.description.slice(0, 37) + "..." : cls.description
      return `${name}${model}${thinking}${desc}`
    })

    return [header, rule, ...rows].join("\n")
  }

  export function statusSummary(tasks: Task.Info[], agents: AgentInstance.Info[]): string {
    const taskStats = {
      total: tasks.length,
      pending: tasks.filter((task) => task.meta.status === "pending").length,
      running: tasks.filter((task) => task.meta.status === "running").length,
      done: tasks.filter((task) => task.meta.status === "done").length,
      failed: tasks.filter((task) => task.meta.status === "failed").length,
    }

    const agentStats = {
      total: agents.length,
      running: agents.filter((agent) => agent.status === "running").length,
      waiting: agents.filter((agent) => agent.status === "waiting").length,
      paused: agents.filter((agent) => agent.status === "paused").length,
    }

    return [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║                      HYDRA STATUS                            ║",
      "╠══════════════════════════════════════════════════════════════╣",
      "║  TASKS                                                       ║",
      `║    Total: ${cell(String(taskStats.total), 5)} Pending: ${cell(String(taskStats.pending), 5)} Running: ${cell(String(taskStats.running), 5)}     ║`,
      `║    Done: ${cell(String(taskStats.done), 6)} Failed: ${cell(String(taskStats.failed), 5)}                          ║`,
      "╠══════════════════════════════════════════════════════════════╣",
      "║  AGENTS                                                      ║",
      `║    Total: ${cell(String(agentStats.total), 5)} Running: ${cell(String(agentStats.running), 5)} Waiting: ${cell(String(agentStats.waiting), 5)}     ║`,
      `║    Paused: ${cell(String(agentStats.paused), 5)}                                            ║`,
      "╚══════════════════════════════════════════════════════════════╝",
      "",
    ].join("\n")
  }
}

