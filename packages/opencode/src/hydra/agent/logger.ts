import fs from "fs/promises"
import path from "node:path"

export namespace AgentLogger {
  export type Level = "info" | "warn" | "error" | "success"

  export interface LogEntry {
    timestamp: string
    level: Level
    message: string
    data?: Record<string, unknown>
  }

  export interface SessionInfo {
    agentId: string
    class: string
    model: string
    thinking: string
    taskId?: string
    taskTitle?: string
    worktree: string
    started: string
  }

  export interface Logger {
    log(level: Level, message: string, data?: Record<string, unknown>): Promise<void>

    info(message: string, data?: Record<string, unknown>): Promise<void>
    warn(message: string, data?: Record<string, unknown>): Promise<void>
    error(message: string, data?: Record<string, unknown>): Promise<void>
    success(message: string, data?: Record<string, unknown>): Promise<void>

    waiting(reason: string): Promise<void>
    complete(summary: string, filesChanged?: string[]): Promise<void>
    received(message: string): Promise<void>

    read(options?: { lines?: number }): Promise<string>
    path(): string
  }

  export function create(session: SessionInfo): Logger {
    return new LoggerImpl(session)
  }

  export function getLogPath(worktree: string): string {
    return path.join(worktree, ".hydra", "agent-log.md")
  }
}

class LoggerImpl implements AgentLogger.Logger {
  private session: AgentLogger.SessionInfo
  private logPath: string
  private init: Promise<void> | undefined

  constructor(session: AgentLogger.SessionInfo) {
    this.session = session
    this.logPath = AgentLogger.getLogPath(session.worktree)
  }

  private async ensureInit(): Promise<void> {
    if (this.init) return this.init
    this.init = this.setup()
    return this.init
  }

  private async setup(): Promise<void> {
    await fs.mkdir(path.dirname(this.logPath), { recursive: true })

    const ok = await Bun.file(this.logPath).exists()
    if (ok) return

    await fs.writeFile(this.logPath, this.formatHeader(), "utf-8")
  }

  private formatHeader(): string {
    const task = this.session.taskId
      ? `- Task: ${this.session.taskId} - ${this.session.taskTitle || ""}\n`
      : ""

    return `# Agent Log: ${this.session.agentId}

## Session Info
- ID: ${this.session.agentId}
- Class: ${this.session.class}
- Model: ${this.session.model}
- Thinking: ${this.session.thinking}
${task}- Worktree: ${this.session.worktree}
- Started: ${this.session.started}

---

## Timeline

`
  }

  private formatTimestamp(): string {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false })
  }

  private levelEmoji(level: AgentLogger.Level): string {
    if (level === "warn") return "⚠️ "
    if (level === "error") return "❌ "
    if (level === "success") return "✅ "
    return ""
  }

  async log(level: AgentLogger.Level, message: string, data?: Record<string, unknown>): Promise<void> {
    await this.ensureInit()

    const time = this.formatTimestamp()
    const emoji = this.levelEmoji(level)
    const json = data ? "\n```json\n" + JSON.stringify(data, null, 2) + "\n```\n" : ""
    const entry = `### ${time} - ${emoji}${message}\n${json}\n`

    await fs.appendFile(this.logPath, entry, "utf-8")
  }

  async info(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log("info", message, data)
  }

  async warn(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log("warn", message, data)
  }

  async error(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log("error", message, data)
  }

  async success(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log("success", message, data)
  }

  async waiting(reason: string): Promise<void> {
    await this.ensureInit()

    const time = this.formatTimestamp()
    const entry = `### ${time} - ⚠️ 等待输入

${reason}

**状态**: 等待主控指示

`

    await fs.appendFile(this.logPath, entry, "utf-8")
  }

  async complete(summary: string, filesChanged?: string[]): Promise<void> {
    await this.ensureInit()

    const time = this.formatTimestamp()
    const list = filesChanged?.length
      ? `**修改的文件**:\n${filesChanged.map((x) => `- ${x}`).join("\n")}\n\n`
      : ""

    const entry = `### ${time} - ✅ 完成

**结果**: 成功

**总结**:
${summary}

${list}`

    await fs.appendFile(this.logPath, entry, "utf-8")
  }

  async received(message: string): Promise<void> {
    await this.ensureInit()

    const time = this.formatTimestamp()
    const quote = message
      .split("\n")
      .map((x) => `> ${x}`)
      .join("\n")

    const entry = `### ${time} - 收到消息

${quote}

`

    await fs.appendFile(this.logPath, entry, "utf-8")
  }

  async read(options?: { lines?: number }): Promise<string> {
    const content = await fs.readFile(this.logPath, "utf-8").catch(() => "")
    if (!options?.lines) return content
    const list = content.split("\n")
    return list.slice(-options.lines).join("\n")
  }

  path(): string {
    return this.logPath
  }
}
