# Task: 实现 Agent 日志系统

## Meta
- id: t005
- status: pending
- priority: P1
- depends: t004
- allow: packages/opencode/src/hydra/**

## Description

实现 Agent 日志系统，让每个 Agent 在自己的 worktree 中记录工作日志。

### 1. 文件位置

```
packages/opencode/src/hydra/agent/
├── logger.ts     # AgentLogger 实现
└── index.ts      # 更新导出
```

### 2. AgentLogger 实现 (logger.ts)

```typescript
import fs from "fs/promises"
import path from "path"

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

  /**
   * Logger 实例
   */
  export interface Logger {
    // 记录日志
    log(level: Level, message: string, data?: Record<string, unknown>): Promise<void>

    // 快捷方法
    info(message: string, data?: Record<string, unknown>): Promise<void>
    warn(message: string, data?: Record<string, unknown>): Promise<void>
    error(message: string, data?: Record<string, unknown>): Promise<void>
    success(message: string, data?: Record<string, unknown>): Promise<void>

    // 标记等待输入
    waiting(reason: string): Promise<void>

    // 标记完成
    complete(summary: string, filesChanged?: string[]): Promise<void>

    // 记录收到的消息
    received(message: string): Promise<void>

    // 读取日志内容
    read(options?: { lines?: number }): Promise<string>

    // 获取日志文件路径
    path(): string
  }

  /**
   * 创建 Logger 实例
   */
  export function create(session: SessionInfo): Logger

  /**
   * 日志文件路径
   */
  export function getLogPath(worktree: string): string {
    return path.join(worktree, ".hydra", "agent-log.md")
  }
}
```

### 3. Logger 实现细节

```typescript
class LoggerImpl implements AgentLogger.Logger {
  private session: AgentLogger.SessionInfo
  private logPath: string
  private initialized = false

  constructor(session: AgentLogger.SessionInfo) {
    this.session = session
    this.logPath = AgentLogger.getLogPath(session.worktree)
  }

  private async ensureInit(): Promise<void> {
    if (this.initialized) return
    
    // 创建目录
    await fs.mkdir(path.dirname(this.logPath), { recursive: true })
    
    // 写入 header
    const header = this.formatHeader()
    await fs.writeFile(this.logPath, header, "utf-8")
    
    this.initialized = true
  }

  private formatHeader(): string {
    return `# Agent Log: ${this.session.agentId}

## Session Info
- ID: ${this.session.agentId}
- Class: ${this.session.class}
- Model: ${this.session.model}
- Thinking: ${this.session.thinking}
${this.session.taskId ? `- Task: ${this.session.taskId} - ${this.session.taskTitle || ""}` : ""}
- Worktree: ${this.session.worktree}
- Started: ${this.session.started}

---

## Timeline

`
  }

  private formatTimestamp(): string {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false })
  }

  private levelEmoji(level: AgentLogger.Level): string {
    switch (level) {
      case "info": return ""
      case "warn": return "⚠️ "
      case "error": return "❌ "
      case "success": return "✅ "
    }
  }

  async log(level: AgentLogger.Level, message: string, data?: Record<string, unknown>): Promise<void> {
    await this.ensureInit()
    
    const time = this.formatTimestamp()
    const emoji = this.levelEmoji(level)
    
    let entry = `### ${time} - ${emoji}${message}\n`
    
    if (data) {
      entry += "\n```json\n" + JSON.stringify(data, null, 2) + "\n```\n"
    }
    
    entry += "\n"
    
    await fs.appendFile(this.logPath, entry, "utf-8")
  }

  async info(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.log("info", message, data)
  }

  async warn(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.log("warn", message, data)
  }

  async error(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.log("error", message, data)
  }

  async success(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.log("success", message, data)
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
    let entry = `### ${time} - ✅ 完成

**结果**: 成功

**总结**:
${summary}

`
    if (filesChanged && filesChanged.length > 0) {
      entry += `**修改的文件**:\n`
      for (const file of filesChanged) {
        entry += `- ${file}\n`
      }
      entry += "\n"
    }
    
    await fs.appendFile(this.logPath, entry, "utf-8")
  }

  async received(message: string): Promise<void> {
    await this.ensureInit()
    
    const time = this.formatTimestamp()
    const entry = `### ${time} - 收到消息

> ${message.split("\n").join("\n> ")}

`
    await fs.appendFile(this.logPath, entry, "utf-8")
  }

  async read(options?: { lines?: number }): Promise<string> {
    try {
      const content = await fs.readFile(this.logPath, "utf-8")
      if (options?.lines) {
        const lines = content.split("\n")
        return lines.slice(-options.lines).join("\n")
      }
      return content
    } catch {
      return ""
    }
  }

  path(): string {
    return this.logPath
  }
}

export function create(session: AgentLogger.SessionInfo): AgentLogger.Logger {
  return new LoggerImpl(session)
}
```

### 4. 日志输出示例

```markdown
# Agent Log: agent-abc123

## Session Info
- ID: agent-abc123
- Class: Coder
- Model: claude-sonnet
- Thinking: high
- Task: t001 - 实现用户登录功能
- Worktree: /path/to/worktree-1
- Started: 2026-01-31 18:00:00

---

## Timeline

### 18:00:05 - 开始分析任务
读取了任务文档，理解需求...

### 18:00:30 - 探索代码库
发现项目使用 React + TypeScript...

```json
{
  "files_found": ["src/auth/index.ts", "src/components/Login.tsx"],
  "framework": "React",
  "language": "TypeScript"
}
```

### 18:01:15 - ⚠️ 等待输入

不确定应该用 JWT 还是 Session 进行认证。

**状态**: 等待主控指示

### 18:05:00 - 收到消息

> 使用 JWT，不要用 Session

### 18:05:05 - 继续执行
收到指示，使用 JWT 方案...

### 18:30:00 - ✅ 完成

**结果**: 成功

**总结**:
实现了用户登录功能，包括登录表单、API 接口和单元测试。

**修改的文件**:
- src/auth/login.tsx (新建)
- src/auth/useAuth.ts (新建)
- src/auth/index.ts (修改)
- tests/auth/login.test.tsx (新建)
```

## Acceptance Criteria

- [ ] AgentLogger.create() 创建 Logger 实例
- [ ] Logger 首次写入时创建文件和 header
- [ ] log/info/warn/error/success 方法正确写入
- [ ] waiting() 方法标记等待状态
- [ ] complete() 方法记录完成信息
- [ ] received() 方法记录收到的消息
- [ ] read() 方法能读取日志内容
- [ ] 支持 lines 参数限制读取行数
- [ ] 日志格式符合示例
- [ ] 有单元测试

## Notes

- 日志文件使用 Markdown 格式，方便阅读
- 时间戳使用本地时间，格式 HH:MM:SS
- 追加写入，不覆盖
- 如果文件不存在，read() 返回空字符串
