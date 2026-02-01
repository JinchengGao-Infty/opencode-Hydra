# Hydra（多 Agent 编排）——主控 AI 指南

## 强制规则：只能用 MCP 工具调度（禁止 CLI）

调度子 AI **必须**使用 Hydra 的 MCP 工具（下文列出的 `hydra_*`），**不要**用 `bash` 执行 `opencode hydra ...`。

原因：MCP 调度会走 OpenCode 进程内的 Hydra Core，子 AI 才会出现在 TUI 的 Hydra tab 中并可被用户控制。

---

## MCP 工具一览（名称 + 参数）

> 所有工具都使用 JSON 参数；未列出字段表示不支持；`?` 表示可选。

### 状态查询

#### `hydra_status({})`
- 参数：无

#### `hydra_task_list({ status? })`
- `status?`: `"pending" | "running" | "done" | "failed" | "cancelled"`

#### `hydra_task_show({ id })`
- `id`: `string`（task id）

#### `hydra_agent_list({ status? })`
- `status?`: `"idle" | "running" | "paused" | "waiting" | "done" | "failed"`

#### `hydra_agent_show({ id })`
- `id`: `string`（agent id）

#### `hydra_agent_logs({ id, lines? })`
- `id`: `string`
- `lines?`: `number`（正整数，最近 N 行）

### 任务管理

#### `hydra_task_create({ title, description?, class?, allow?, model?, thinking?, timeout?, depends? })`
- `title`: `string`
- `description?`: `string`（默认 `""`）
- `class?`: `string`（AgentClass 名称，如 `Coder` / `Codex`）
- `allow?`: `string[]`（默认 `[]`，允许修改的文件 glob）
- `model?`: `string`（覆盖 AgentClass 默认模型，如 `anthropic/claude-sonnet`）
- `thinking?`: `"low" | "medium" | "high" | "xhigh"`（覆盖默认思考级别；`xhigh` 通常用于 GPT/Codex 类模型）
- `timeout?`: `number`（秒）
- `depends?`: `string[]`（默认 `[]`，依赖的 task ids）

#### `hydra_task_cancel({ id })`
- `id`: `string`

### Agent 管理

#### `hydra_agent_spawn({ class, task?, model?, thinking?, prompt?, callback? })`
- `class`: `string`（AgentClass 名称）
- `task?`: `string`（绑定 task id；绑定后会自动启动）
- `model?`: `string`
- `thinking?`: `"low" | "medium" | "high" | "xhigh"`（`xhigh` 通常用于 GPT/Codex 类模型）
- `prompt?`: `string`（可选的初始消息；**注意：如果提供 `prompt`，必须同时提供 `task`**）
- `callback?`: 完成/失败/等待时回调通知（可选）
  - `url?`: `string`（HTTP webhook）
  - `command?`: `string`（命令行回调）
  - `events?`: `("completed" | "failed" | "waiting")[]`（默认 `["completed", "failed"]`）
  - `headers?`: `Record<string, string>`（仅用于 `url`）
  - 约束：`callback` 必须至少提供 `url` 或 `command` 其中之一

#### `hydra_agent_send({ id, message })`
- `id`: `string`
- `message`: `string`

#### `hydra_agent_pause({ id })`
- `id`: `string`

#### `hydra_agent_resume({ id })`
- `id`: `string`

#### `hydra_agent_kill({ id, cleanup? })`
- `id`: `string`
- `cleanup?`: `boolean`（是否清理 worktree）

### 调度控制

#### `hydra_start({})`
- 参数：无（启动自动调度：自动给 pending task 分配空闲 Agent）

#### `hydra_stop({})`
- 参数：无（停止自动调度）

---

## 配置：AgentClass（项目文件 `.hydra/config.yaml`）

Hydra 会加载并合并：
- 项目配置：`<projectRoot>/.hydra/config.yaml`（优先级最高）
- 全局配置：`~/.config/opencode/hydra.yaml`（可选；测试环境可能被 `OPENCODE_TEST_HOME` 重定向）
- 兼容旧文件：`<projectRoot>/.hydra/agents.yaml`

### 最小示例

```yaml
defaults:
  model: anthropic/claude-sonnet
  thinking: medium
  timeout: 3600
  maxAgents: 3

scheduler:
  autoStart: false
  retryOnFail: true
  maxRetries: 2

classes:
  Coder:
    prompt: |
      额外提示：先写测试，再实现。

  MyAgent:
    description: "自定义 Agent（会替换同名内置类）"
    model: openai/gpt-4.1
    thinking: high
    prompt: |
      你是专注于性能优化的 Agent。
    tools: ["read", "grep", "edit"]
    timeout: 7200
```

说明：
- 内置类：`Coder` / `Codex` / `Architect` / `Writer` / `Reviewer`
- 覆盖规则：对内置类，如果只提供 `prompt`（不写 `description`），会把你的 `prompt` 追加到内置 prompt 后；如果写了 `description`，会按“替换”为主（相当于自定义类）
- `tools`：用于限制子 AI 可用工具（未配置表示不限制；配置为空数组表示“无工具”）

---

## 配置：API Key 与 Provider（给子 AI 用）

在 `.hydra/config.yaml` 里配置 `providers`（会注入到子 AI 的 `OPENCODE_CONFIG_CONTENT` 中）：

```yaml
providers:
  anthropic:
    apiKey: sk-ant-xxx
  openai:
    apiKey: sk-xxx
    endpoint: https://api.openai.com/v1
```

说明：
- `providers.<name>.apiKey` → 子 AI 的 provider `apiKey`
- `providers.<name>.endpoint` → 子 AI 的 provider `baseURL`
- `<name>` 必须是 OpenCode 识别的 provider 名称（例如 `openai` / `anthropic` 等）

---

## 完整使用示例（主控 AI）

```txt
# 0) 可选：查看 Hydra 状态
hydra_status({})

# 1) 创建任务（只创建，不会自动 spawn；你可以手动 spawn 或调用 hydra_start 自动调度）
task = hydra_task_create({
  title: "重构 auth 模块",
  description: "拆分 auth 逻辑，补齐测试，保证向后兼容",
  class: "Coder",
  allow: ["src/auth/**", "tests/auth/**"],
  thinking: "medium",
  timeout: 3600
})

# 2) 启动 Agent 执行任务（会出现在 TUI 的 Hydra tab）
agent = hydra_agent_spawn({
  class: "Coder",
  task: task.meta.id,
  prompt: "先跑现有测试，保持行为不变；必要时先加测试再改代码。",
  callback: {
    command: "echo '[{event}] agent={agentId} task={taskId} at {timestamp}' >> .hydra/events.log",
    events: ["completed", "failed", "waiting"]
  }
})

# 3) 跟进日志 / 状态
hydra_agent_logs({ id: agent.id, lines: 80 })
hydra_agent_show({ id: agent.id })

# 4) Agent 等待输入时给指令
hydra_agent_send({ id: agent.id, message: "只重构，不改对外 API；新增测试覆盖边界情况。" })

# 5) 必要时暂停/恢复/终止
hydra_agent_pause({ id: agent.id })
hydra_agent_resume({ id: agent.id })
hydra_agent_kill({ id: agent.id, cleanup: true })
```
