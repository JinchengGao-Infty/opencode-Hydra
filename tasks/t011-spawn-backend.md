# Task: 接入后端（spawn 真正启动进程）

## Meta
- id: t011
- status: pending
- priority: P0
- depends: t009
- allow: packages/opencode/src/hydra/**

## Description

让 AgentManager.spawn() 真正启动 AI 进程，而不只是创建记录。

### 要做的事

1. **调用 opencode run 启动子 AI**
   - 使用 `Bun.spawn()` 或 `child_process`
   - 传入 model、thinking、systemPrompt

2. **连接子进程 I/O**
   - 捕获 stdout/stderr
   - 写入 stdin（用于 send 消息）

3. **输出到 AgentLogger**
   - 实时记录子 AI 输出
   - 发出 HydraEvent

4. **进程生命周期管理**
   - pause → SIGSTOP
   - resume → SIGCONT
   - kill → SIGTERM

### 接口设计

```typescript
// AgentManager.spawn 内部
const proc = Bun.spawn({
  cmd: ["opencode", "run", "--model", model, "--thinking", thinking],
  cwd: worktreePath,
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
})

// 捕获输出
proc.stdout.on("data", (chunk) => {
  logger.write(agentId, chunk)
  HydraBus.emit(HydraEvent.AgentOutput, { agentId, data: chunk })
})

// send 消息
AgentManager.send(agentId, message) {
  proc.stdin.write(message + "\n")
}
```

## Acceptance Criteria

- [ ] spawn 后能看到子 AI 真正运行
- [ ] send 能给子 AI 发消息
- [ ] logs 能看到实时输出
- [ ] pause/resume/kill 正常工作
- [ ] 子 AI 完成后状态正确更新
