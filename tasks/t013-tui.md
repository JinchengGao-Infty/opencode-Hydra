# Task: TUI 改造

## Meta
- id: t013
- status: pending
- priority: P1
- depends: t011
- allow: packages/opencode/src/tui/**, packages/opencode/src/hydra/**

## Description

改造 OpenCode TUI，让用户能看到和控制子 AI。

### 界面设计

```
┌─────────────────────────────────────────────────────────────┐
│ [Main] [Coder-1] [Coder-2] [Writer-1]      Agents: 3 running│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Coder-1 (running) - Task: t001 重构数据库                  │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Agent: 我正在分析 src/db/ 目录结构...                      │
│  Agent: 发现以下文件需要修改：                              │
│         - connection.ts                                     │
│         - query.ts                                          │
│         - migrations/                                       │
│  Agent: 开始修改 connection.ts...                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ > 用 PostgreSQL，不要用 MySQL                               │
└─────────────────────────────────────────────────────────────┘
```

### 功能点

1. **Tab 切换**
   - `Tab` / `Shift+Tab` 切换 Agent
   - `Ctrl+1/2/3...` 快速跳转
   - Main tab 是主对话

2. **实时日志**
   - 订阅 `HydraEvent.AgentOutput`
   - 实时显示在对应 tab

3. **发送消息**
   - 在 Agent tab 输入，发送给该 Agent
   - 调用 `AgentManager.send()`

4. **状态显示**
   - 顶栏显示 Agent 数量和状态
   - 每个 tab 显示 Agent 状态（running/waiting/paused）
   - 颜色区分：🟢 running / 🟡 waiting / 🔴 paused

5. **快捷操作**
   - `Ctrl+P` 暂停当前 Agent
   - `Ctrl+R` 恢复当前 Agent
   - `Ctrl+K` 终止当前 Agent

### 技术实现

1. **修改 TUI 组件**
   - 参考 `packages/opencode/src/tui/`
   - 使用 Ink（React for CLI）

2. **状态管理**
   - 订阅 HydraBus 事件
   - 维护 agents 列表和当前选中

3. **新增组件**
   ```
   src/tui/
   ├── hydra/
   │   ├── AgentTabs.tsx      # Tab 栏
   │   ├── AgentPanel.tsx     # Agent 对话面板
   │   ├── AgentStatus.tsx    # 状态显示
   │   └── index.tsx          # 整合
   ```

## Acceptance Criteria

- [ ] 能看到所有 Agent 的 tab
- [ ] 能切换查看不同 Agent
- [ ] 能实时看到 Agent 输出
- [ ] 能给 Agent 发消息
- [ ] 能暂停/恢复/终止 Agent
- [ ] 状态实时更新
