# t018: 前端界面集成

## 目标

将 Hydra 功能集成到 opencode 的 Web 前端界面中。

## 背景

opencode 有一个 Web 前端（基于 React），我们需要把 Hydra 的功能加进去，让用户可以通过浏览器管理多 Agent 系统。

## 任务

### 1. 分析现有前端结构

- 找到前端代码位置（可能在 `packages/web` 或 `packages/opencode/src/web`）
- 了解现有的路由、组件结构
- 了解状态管理方案

### 2. 添加 Hydra 页面入口

在导航栏/侧边栏添加 "Hydra" 入口，链接到 Hydra 管理页面。

### 3. 实现 Hydra Dashboard

**主面板**：
- 显示 Hydra 状态（是否运行、Agent 数量、任务数量）
- 快速操作按钮（启动/停止 Hydra）

**任务管理**：
- 任务列表（状态、标题、分配的 Agent）
- 创建新任务表单
- 任务详情页

**Agent 管理**：
- Agent 列表（状态、类型、当前任务）
- Agent 详情页
  - 实时日志输出
  - 发送消息输入框
  - 控制按钮（暂停/恢复/终止）
- 创建新 Agent（选择 AgentClass、分配任务）

**AgentClass 管理**：
- 查看预置的 AgentClass
- 编辑/创建自定义 AgentClass

### 4. 实时更新

- WebSocket 或 SSE 连接，实时显示：
  - Agent 状态变化
  - Agent 输出日志
  - 任务状态变化

### 5. UI 组件

需要的组件：
- `HydraDashboard` - 主面板
- `TaskList` - 任务列表
- `TaskDetail` - 任务详情
- `TaskCreateForm` - 创建任务表单
- `AgentList` - Agent 列表
- `AgentDetail` - Agent 详情（含日志）
- `AgentClassList` - AgentClass 列表
- `LogViewer` - 实时日志查看器
- `StatusBadge` - 状态徽章（running/idle/error）

### 6. API 集成

前端需要调用的 API（通过 Hydra MCP Server 或 REST）：
- `GET /hydra/status` - 获取状态
- `GET /hydra/tasks` - 任务列表
- `POST /hydra/tasks` - 创建任务
- `GET /hydra/agents` - Agent 列表
- `POST /hydra/agents` - 创建 Agent
- `POST /hydra/agents/:id/send` - 发送消息
- `GET /hydra/agents/:id/logs` - 获取日志（支持 streaming）
- `POST /hydra/agents/:id/pause` - 暂停
- `POST /hydra/agents/:id/resume` - 恢复
- `DELETE /hydra/agents/:id` - 终止

## 设计参考

参考 t013 TUI 的设计，保持一致的交互逻辑：
- Tab 切换 Agent
- 实时日志滚动
- 消息发送

## 文件变更

- `packages/web/src/pages/Hydra/` - Hydra 页面组件
- `packages/web/src/components/Hydra/` - Hydra 相关组件
- `packages/web/src/api/hydra.ts` - API 调用
- `packages/web/src/routes.tsx` - 添加路由

## 验收标准

- [ ] 导航栏有 Hydra 入口
- [ ] Dashboard 显示正确状态
- [ ] 能创建/查看任务
- [ ] 能创建/管理 Agent
- [ ] 实时日志正常显示
- [ ] 能发送消息给 Agent
- [ ] 响应式设计，移动端可用
