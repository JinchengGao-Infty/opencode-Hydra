# t017: Hydra Skill 文档

## 目标

为主控 AI 编写 Hydra 使用指南，让它知道如何有效地使用 Hydra 多 Agent 系统。

## 背景

主控 AI 通过 MCP 获得了 `hydra_*` 工具，但它需要知道：
- 什么时候该用 Hydra
- 怎么拆分任务
- 怎么选择 AgentClass
- 怎么监控和管理 Agent

## 任务

### 1. 创建 Hydra Skill

在 OpenClaw skills 目录创建 `hydra/SKILL.md`：

```markdown
# Hydra - 多 Agent 编排系统

## 什么是 Hydra

Hydra 让你能派遣子 Agent 并行处理任务。每个 Agent 在独立的 git worktree 中工作，互不干扰。

## 什么时候用 Hydra

✅ 适合用 Hydra：
- 复杂任务需要拆分成多个独立部分
- 任务耗时长（>10分钟）
- 需要并行处理多个文件/模块
- 代码重构、大规模修改

❌ 不适合用 Hydra：
- 简单的单文件修改
- 需要即时反馈的交互
- 任务之间有强依赖

## 工作流程

### 1. 创建任务
\`\`\`
hydra_task_create({
  title: "实现用户认证模块",
  description: "详细的任务描述...",
  class: "coder",
  allow: ["src/auth/**"]
})
\`\`\`

### 2. 派遣 Agent
\`\`\`
hydra_agent_spawn({
  class: "coder",
  task: "t1234567890"
})
\`\`\`

### 3. 监控进度
\`\`\`
hydra_agent_logs({ id: "coder-1" })
hydra_status()
\`\`\`

### 4. 合并结果
Agent 完成后，检查代码并合并到主分支。

## AgentClass 选择

| Class | 用途 | 特点 |
|-------|------|------|
| coder | 写代码 | 自动批准，专注实现 |
| reviewer | 代码审查 | 只读，提供反馈 |
| architect | 架构设计 | 设计文档，任务拆分 |

## 最佳实践

1. **任务文档要详细** - Agent 看不到你的上下文，写清楚需求
2. **限制文件范围** - 用 `allow` 限制 Agent 只能改特定文件
3. **不要频繁检查** - Agent 需要时间，每小时看一次就够
4. **一个任务一个 Agent** - 避免让一个 Agent 做太多事

## 常用命令

| 命令 | 用途 |
|------|------|
| `hydra_status()` | 查看整体状态 |
| `hydra_task_list()` | 列出所有任务 |
| `hydra_agent_list()` | 列出所有 Agent |
| `hydra_agent_logs(id)` | 查看 Agent 输出 |
| `hydra_agent_send(id, msg)` | 给 Agent 发消息 |
| `hydra_agent_kill(id)` | 终止 Agent |
```

### 2. 注册到 OpenClaw

更新 OpenClaw 的 skills 配置，让主控 AI 能发现这个 skill。

### 3. 编写示例场景

添加几个实际使用场景的示例：

**场景 1：重构项目结构**
```
1. 用 architect 分析现有代码，输出重构计划
2. 拆分成多个独立任务
3. 派多个 coder 并行重构
4. 用 reviewer 检查结果
5. 合并所有改动
```

**场景 2：实现新功能**
```
1. 创建任务文档，描述功能需求
2. 派 coder 实现
3. 等待完成，检查代码
4. 合并到主分支
```

## 文件变更

- `/Users/link/openclaw/skills/hydra/SKILL.md` - 主文档
- `/Users/link/openclaw/skills/hydra/examples/` - 示例场景

## 验收标准

- [ ] SKILL.md 内容完整清晰
- [ ] 主控 AI 能通过 skill 发现 Hydra
- [ ] 示例场景可操作
