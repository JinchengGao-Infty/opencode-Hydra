# Task: 实现无人值守模式

## Meta
- id: t008
- status: pending
- priority: P0
- depends: t001
- allow: packages/opencode/src/**

## Description

修改 OpenCode 的权限系统，支持无人值守模式（自动确认所有操作）。

### 1. 需要修改的文件

```
packages/opencode/src/
├── cli/
│   └── run.ts            # 添加 --unattended 参数
├── permission/
│   └── next.ts           # 修改权限检查逻辑
└── session/
    └── processor.ts      # 修改确认流程
```

### 2. 添加 --unattended 参数

修改 `packages/opencode/src/cli/run.ts`（或对应的 run 命令文件）：

```typescript
// 添加参数定义
.option("unattended", {
  type: "boolean",
  default: false,
  description: "Run in unattended mode (auto-approve all actions)",
})

// 传递给 session
const session = await Session.create({
  // ... 其他参数
  unattended: args.unattended,
})
```

### 3. 修改 Session 配置

在 Session 创建时支持 unattended 模式：

```typescript
// packages/opencode/src/session/index.ts

export namespace Session {
  export interface CreateOptions {
    // ... 现有选项
    unattended?: boolean  // 新增
  }

  export interface Info {
    // ... 现有字段
    unattended: boolean   // 新增
  }
}
```

### 4. 修改权限检查逻辑

修改 `packages/opencode/src/permission/next.ts`：

```typescript
export namespace PermissionNext {
  /**
   * 检查权限
   * @param permission 权限类型
   * @param pattern 匹配模式
   * @param ruleset 规则集
   * @param unattended 是否无人值守模式
   */
  export function check(
    permission: string,
    pattern: string,
    ruleset: Ruleset,
    unattended: boolean = false
  ): "allow" | "deny" | "ask" {
    const action = matchRule(permission, pattern, ruleset)
    
    // 无人值守模式：ask 变成 allow
    if (unattended && action === "ask") {
      return "allow"
    }
    
    return action
  }
}
```

### 5. 修改确认流程

修改 `packages/opencode/src/session/processor.ts`（或处理工具调用的地方）：

```typescript
// 在需要确认的地方
async function handleToolCall(tool: Tool, args: unknown, session: Session.Info) {
  const permission = getRequiredPermission(tool)
  const action = PermissionNext.check(
    permission,
    getPattern(args),
    session.agent.permission,
    session.unattended  // 传入 unattended 标志
  )

  if (action === "deny") {
    throw new PermissionDeniedError(...)
  }

  if (action === "ask") {
    // 正常模式：等待用户确认
    const confirmed = await askUserConfirmation(...)
    if (!confirmed) {
      throw new PermissionDeniedError(...)
    }
  }

  // allow 或 unattended 模式下的 ask：直接执行
  return await executeTool(tool, args)
}
```

### 6. 日志记录

无人值守模式下，记录自动批准的操作：

```typescript
if (session.unattended && originalAction === "ask") {
  log.info("Auto-approved in unattended mode", {
    permission,
    pattern,
    tool: tool.name,
  })
}
```

### 7. 安全考虑

即使在无人值守模式下，某些操作仍然应该被拒绝：

```typescript
// 危险操作黑名单（即使 unattended 也不允许）
const DANGEROUS_PATTERNS = [
  "rm -rf /",
  "rm -rf ~",
  ":(){ :|:& };:",  // fork bomb
  // ... 其他危险命令
]

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(p => command.includes(p))
}

// 在执行前检查
if (isDangerous(command)) {
  throw new DangerousOperationError("This operation is not allowed even in unattended mode")
}
```

### 8. 测试命令

```bash
# 正常模式（需要确认）
opencode run "创建一个文件"

# 无人值守模式（自动确认）
opencode run --unattended "创建一个文件"

# 结合其他参数
opencode run --unattended --format json -m anthropic/claude-sonnet "任务描述"
```

## Acceptance Criteria

- [ ] `opencode run --unattended` 参数可用
- [ ] 无人值守模式下，ask 权限自动变成 allow
- [ ] deny 权限仍然被拒绝
- [ ] 危险操作即使在无人值守模式下也被拒绝
- [ ] 自动批准的操作有日志记录
- [ ] Session 信息中包含 unattended 标志
- [ ] 有单元测试

## Notes

- 这是 Hydra 的基础功能，Agent 需要在无人值守模式下运行
- 安全性很重要，要有危险操作黑名单
- 日志记录方便事后审计
- 可以考虑添加 `--max-steps` 参数限制最大步数
