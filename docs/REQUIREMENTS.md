# OpenCode-Hydra 需求文档

## 概述

OpenCode-Hydra 是基于 OpenCode 的多 Agent 编排系统，支持：
- 无人值守模式（睡前派活，醒来收货）
- 任务文档驱动
- 主控 AI 管理多个子 Agent
- 跨模型协作
- 人类可随时介入

## 核心概念

```
主控 AI（你/Link/其他 AI）
    │
    ├── 实例化子 Agent（从预设类）
    ├── 分发任务 → task.md
    ├── 监控进度（读子 Agent 日志）
    ├── 合并结果
    └── 人类可随时介入/打断
    
子 Agent（多个，各自独立 worktree）
    ├── Agent-1: Coder(model=claude, thinking=high)
    ├── Agent-2: Coder(model=codex, thinking=low)
    └── Agent-3: Writer(model=gemini)
    
每个子 Agent 在自己的 worktree 写日志
```

---

## 功能需求

### 1. 无人值守模式

**描述**：启动后自动执行任务，不需要人确认

**需求**：
- 类似 Codex 的 `--yolo` 模式
- 自动确认所有操作
- 可设置超时时间
- 可设置最大步数

**CLI**：
```bash
opencode run --unattended --task task.md --timeout 3600 --max-steps 100
```

---

### 2. 任务文档系统

**描述**：用 Markdown 文档描述任务，Agent 自动执行

**任务文档格式**：
```markdown
# Task: 实现用户登录功能

## Meta
- id: t001
- status: pending | running | done | failed
- agent_class: Coder
- model: anthropic/claude-sonnet
- thinking: high
- allow: src/auth/**, tests/auth/**
- timeout: 3600
- depends: t000  # 可选，依赖其他任务
- created: 2026-01-31 18:00:00
- started: 
- finished: 

## Description
实现用户登录功能，包括：
1. 登录表单组件
2. API 接口
3. 单元测试

## Output
（Agent 完成后填写执行结果）

## Files Changed
（Agent 完成后列出修改的文件）
```

**任务状态流转**：
```
pending → running → done
                 → failed
```

**任务目录结构**：
```
project/
├── .hydra/
│   ├── tasks/
│   │   ├── t001.md
│   │   ├── t002.md
│   │   └── ...
│   └── config.yaml
└── ...
```

---

### 3. 主控接口

**描述**：主控 AI 通过 CLI/API 管理任务和 Agent

**CLI 命令**：
```bash
# 任务管理
hydra task create "实现登录功能" --class Coder --allow "src/**"
hydra task list
hydra task status <task_id>
hydra task cancel <task_id>
hydra task result <task_id>

# Agent 管理
hydra agent list              # 查看运行中的 Agent
hydra agent spawn <class>     # 实例化 Agent
hydra agent logs <agent_id>   # 查看日志
hydra agent kill <agent_id>   # 终止 Agent
```

**API 接口**：
```
POST   /api/tasks              # 创建任务
GET    /api/tasks              # 列出任务
GET    /api/tasks/:id          # 任务详情
DELETE /api/tasks/:id          # 取消任务

POST   /api/agents             # 实例化 Agent
GET    /api/agents             # 列出 Agent
GET    /api/agents/:id         # Agent 详情
GET    /api/agents/:id/logs    # Agent 日志
POST   /api/agents/:id/send    # 向 Agent 发送消息
POST   /api/agents/:id/pause   # 暂停 Agent
POST   /api/agents/:id/resume  # 恢复 Agent
DELETE /api/agents/:id         # 终止 Agent
```

---

### 4. 子 Agent 类系统

**描述**：预设 Agent 类，实例化时可覆盖参数

**类定义**（`.hydra/agents.yaml`）：
```yaml
classes:
  Coder:
    description: "写代码的 Agent"
    prompt: |
      你是一个专业的程序员。
      写代码时注意：
      1. 遵循项目代码风格
      2. 写单元测试
      3. 添加必要注释
    default_model: anthropic/claude-sonnet
    default_thinking: medium
    
  Architect:
    description: "架构设计 Agent"
    prompt: |
      你是一个资深架构师。
      设计时注意：
      1. 可扩展性
      2. 性能
      3. 安全性
    default_model: anthropic/claude-opus
    default_thinking: high
    
  Writer:
    description: "写文档的 Agent"
    prompt: |
      你是一个技术文档专家。
      写文档时注意：
      1. 清晰易懂
      2. 示例丰富
      3. 结构合理
    default_model: google/gemini-2
    default_thinking: low
    
  Reviewer:
    description: "代码审查 Agent"
    prompt: |
      你是一个严格的代码审查员。
      审查时注意：
      1. 代码质量
      2. 安全漏洞
      3. 性能问题
    default_model: anthropic/claude-opus
    default_thinking: high
```

**实例化时可覆盖的参数**：
- `name`: 实例名称
- `model`: 使用的模型
- `thinking`: 思考强度（low/medium/high）
- `prompt`: 额外的提示词（追加到类的 prompt）
- `allow`: 允许修改的文件

**CLI**：
```bash
hydra agent spawn Coder \
  --name "login-coder" \
  --model openai/gpt-5 \
  --thinking high \
  --task t001
```

**数据结构**：
```typescript
// 类定义
interface AgentClass {
  name: string
  description: string
  prompt: string
  default_model: string
  default_thinking: "low" | "medium" | "high"
}

// 实例
interface AgentInstance {
  id: string
  class: string           // 来自哪个类
  name: string            // 实例名
  model: string           // 实际使用的模型
  thinking: string        // 实际的思考强度
  worktree: string        // 工作目录
  task: string            // 当前任务 ID
  status: "idle" | "running" | "paused" | "done" | "failed"
  pid?: number            // 进程 ID
  created: Date
  started?: Date
  finished?: Date
}
```

---

### 5. 子 Agent 日志系统

**描述**：每个子 Agent 在自己的 worktree 写日志，方便主控和人类查看

**日志位置**：
```
worktree-1/
├── .hydra/
│   └── agent-log.md      # Agent 日志
├── src/
└── ...
```

**日志格式**：
```markdown
# Agent Log: login-coder

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
现有的认证模块在 `src/auth/`...

### 18:01:15 - ⚠️ 遇到困难
不确定应该用 JWT 还是 Session，需要主控确认。

**状态**: 等待输入

### 18:05:00 - 收到主控指示
> 使用 JWT，不要用 Session

继续执行...

### 18:10:00 - 开始编码
创建文件：
- `src/auth/login.tsx`
- `src/auth/useAuth.ts`
- `tests/auth/login.test.tsx`

### 18:30:00 - ✅ 完成

**结果**: 成功

**修改的文件**:
- `src/auth/login.tsx` (新建)
- `src/auth/useAuth.ts` (新建)
- `src/auth/index.ts` (修改)
- `tests/auth/login.test.tsx` (新建)

**测试结果**: 全部通过 (5/5)
```

**日志用途**：
1. 主控 AI 读取，了解进度和状态
2. 人类查看，了解 Agent 在做什么
3. 遇到困难时，Agent 标记等待输入
4. 事后复盘，分析 Agent 行为

---

### 6. 完成通知机制

**描述**：子 Agent 完成后，主控 AI 能及时知道

**方案**：Event Bus + 文件监听

**事件类型**：
```typescript
// 任务事件
task.created    // 任务创建
task.started    // 任务开始
task.progress   // 任务进度更新
task.completed  // 任务完成
task.failed     // 任务失败

// Agent 事件
agent.spawned   // Agent 实例化
agent.started   // Agent 开始执行
agent.paused    // Agent 暂停
agent.resumed   // Agent 恢复
agent.waiting   // Agent 等待输入
agent.completed // Agent 完成
agent.failed    // Agent 失败
agent.killed    // Agent 被终止
```

**通知方式**：
1. **Event Bus**：进程内事件订阅
2. **文件监听**：监听任务状态文件变化
3. **Webhook**（可选）：HTTP 回调通知外部系统

---

### 7. 人类介入/打断

**描述**：人可以随时查看状态和干预 Agent

**查看状态**：
```bash
# 查看所有运行中的 Agent
hydra status

# 输出：
# AGENT          CLASS      TASK    STATUS    WORKTREE
# login-coder    Coder      t001    running   worktree-1
# doc-writer     Writer     t002    waiting   worktree-2

# 查看某个 Agent 的日志
hydra logs login-coder

# 实时跟踪（类似 tail -f）
hydra logs login-coder --follow
```

**介入操作**：
```bash
# 向 Agent 发送消息/指令
hydra send login-coder "用 JWT，不要用 Session"

# 暂停 Agent（完成当前步骤后暂停）
hydra pause login-coder

# 恢复执行
hydra resume login-coder

# 强制终止
hydra kill login-coder

# 进入交互模式（接管 Agent）
hydra attach login-coder
```

---

### 8. 多 Agent 编排

**描述**：同时运行多个子 Agent，各自独立 worktree

**架构**：
```
hydra-server（常驻进程）
    │
    ├── TaskQueue（任务队列）
    │     ├── 任务优先级
    │     ├── 任务依赖
    │     └── 失败重试
    │
    ├── AgentPool（Agent 池）
    │     ├── agent-1 (worktree-1, claude)
    │     ├── agent-2 (worktree-2, codex)
    │     └── agent-3 (worktree-3, gemini)
    │
    └── EventBus（事件总线）
          └── 任务完成 → 通知主控
```

**并行控制**：
- 最大并行 Agent 数量（可配置）
- 资源限制（CPU、内存）
- 任务依赖调度

---

## 优先级

| 优先级 | 功能 | 描述 |
|--------|------|------|
| P0 | 无人值守模式 | 基础能力 |
| P0 | 任务文档系统 | 驱动整个流程 |
| P1 | 子 Agent 类系统 | 预设 + 实例化 |
| P1 | 子 Agent 日志系统 | 可观测性 |
| P1 | 完成通知机制 | 主控感知 |
| P2 | 人类介入/打断 | 可控性 |
| P2 | 多 Agent 编排 | 并行能力 |
| P3 | Web UI | 可视化管理 |

---

## 非功能需求

### 可靠性
- Agent 崩溃后可恢复
- 任务状态持久化
- 日志不丢失

### 可观测性
- 详细的日志
- 状态可查询
- 进度可追踪

### 可扩展性
- 支持自定义 Agent 类
- 支持自定义模型
- 支持插件机制

### 安全性
- 文件权限控制（allow 白名单）
- 敏感文件保护（.env 等）
- 操作审计日志

---

## 术语表

| 术语 | 定义 |
|------|------|
| 主控 AI | 管理任务和子 Agent 的 AI（如 Link） |
| 子 Agent | 执行具体任务的 AI 实例 |
| Agent 类 | 预设的 Agent 模板（如 Coder、Writer） |
| Agent 实例 | 从类实例化的具体 Agent |
| 任务 | 一个具体的工作单元，用 task.md 描述 |
| Worktree | Git worktree，每个 Agent 独立的工作目录 |
| 无人值守 | Agent 自动执行，不需要人确认 |

---

*文档版本: v1.0*
*最后更新: 2026-01-31*
