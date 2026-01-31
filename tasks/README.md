# OpenCode-Hydra 任务列表

## 任务依赖图

```
t001 (Task 数据结构)
  │
  ├──▶ t002 (TaskManager)
  │       │
  │       └──▶ t009 (HydraCore) ──▶ t010 (测试文档)
  │             ▲
  ├──▶ t003 (AgentClass)          │
  │       │                       │
  │       └──▶ t004 (AgentManager)┘
  │             │
  │             └──▶ t005 (AgentLogger)
  │             │
  │             └──▶ t006 (EventSystem)
  │                   │
  │                   └──▶ t007 (CLI) ──▶ t010
  │
  └──▶ t008 (无人值守模式) ──▶ t009
```

## 任务清单

| ID | 任务 | 优先级 | 依赖 | 状态 |
|----|------|--------|------|------|
| t001 | Task 数据结构和解析器 | P0 | - | pending |
| t002 | TaskManager 任务管理器 | P0 | t001 | pending |
| t003 | AgentClass 类系统 | P1 | t001 | pending |
| t004 | AgentInstance 和 AgentManager | P1 | t003 | pending |
| t005 | Agent 日志系统 | P1 | t004 | pending |
| t006 | Event 事件系统 | P1 | t004 | pending |
| t007 | Hydra CLI 命令 | P2 | t002, t004, t005, t006 | pending |
| t008 | 无人值守模式 | P0 | t001 | pending |
| t009 | HydraCore 核心调度器 | P1 | t002, t004, t006, t008 | pending |
| t010 | 集成测试和文档 | P2 | t007, t009 | pending |

## 执行顺序建议

### Phase 1: 基础（可并行）
1. **t001** - Task 数据结构（基础，无依赖）
2. **t008** - 无人值守模式（修改 OpenCode 权限系统）

### Phase 2: Task 模块
3. **t002** - TaskManager（依赖 t001）

### Phase 3: Agent 模块（可并行）
4. **t003** - AgentClass（依赖 t001）
5. **t004** - AgentManager（依赖 t003）
6. **t005** - AgentLogger（依赖 t004）
7. **t006** - EventSystem（依赖 t004）

### Phase 4: 集成
8. **t009** - HydraCore（依赖 t002, t004, t006, t008）
9. **t007** - CLI（依赖 t002, t004, t005, t006）

### Phase 5: 收尾
10. **t010** - 测试和文档（依赖 t007, t009）

## 工作量估计

| 任务 | 预计时间 | 复杂度 |
|------|----------|--------|
| t001 | 1-2h | 低 |
| t002 | 2-3h | 中 |
| t003 | 2-3h | 中 |
| t004 | 4-6h | 高 |
| t005 | 1-2h | 低 |
| t006 | 2-3h | 中 |
| t007 | 3-4h | 中 |
| t008 | 2-3h | 中 |
| t009 | 4-6h | 高 |
| t010 | 3-4h | 中 |

**总计**: 约 24-36 小时

## 给 Codex 的建议

1. **先做 t001 和 t008**，这两个是基础且可以并行
2. **t004 是最复杂的**，需要集成 OpenCode 的 Worktree 模块
3. **参考 OpenCode 现有代码风格**，保持一致
4. **每个任务完成后运行测试**，确保不破坏现有功能
5. **遇到不确定的地方**，在代码中添加 TODO 注释

## 文件位置总结

```
packages/opencode/src/
├── hydra/                      # 新增目录
│   ├── index.ts
│   ├── core.ts                 # t009
│   ├── task/
│   │   ├── index.ts
│   │   ├── task.ts             # t001
│   │   ├── parser.ts           # t001
│   │   └── manager.ts          # t002
│   ├── agent/
│   │   ├── index.ts
│   │   ├── class.ts            # t003
│   │   ├── instance.ts         # t004
│   │   ├── manager.ts          # t004
│   │   ├── logger.ts           # t005
│   │   └── prompts/            # t003
│   │       ├── coder.txt
│   │       ├── architect.txt
│   │       ├── writer.txt
│   │       └── reviewer.txt
│   ├── event/
│   │   ├── index.ts
│   │   ├── events.ts           # t006
│   │   └── bus.ts              # t006
│   └── cli/
│       ├── index.ts            # t007
│       ├── task.ts             # t007
│       ├── agent.ts            # t007
│       ├── status.ts           # t007
│       └── format.ts           # t007
├── cli/
│   └── index.ts                # 修改，添加 hydra 命令
├── permission/
│   └── next.ts                 # t008 修改
└── session/
    └── processor.ts            # t008 修改
```
