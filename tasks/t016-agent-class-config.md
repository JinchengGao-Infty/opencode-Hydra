# t016: AgentClass 配置扩展

## 目标

扩展 AgentClass 配置，支持完整的 AI 模型配置。

## 背景

当前 AgentClass 只有基础字段（name, role, prompts），需要扩展以支持：
- 不同的 AI 模型
- API 配置
- 工具权限
- 资源限制

## 任务

### 1. 扩展 AgentClass 类型定义

```typescript
interface AgentClassConfig {
  // 基础信息
  name: string;           // 类名：coder, reviewer, architect
  role: string;           // 角色描述
  
  // 模型配置
  model: string;          // 模型名：gpt-5.2, claude-4, etc
  provider?: string;      // 提供商：openai, anthropic, local
  apiKey?: string;        // API 密钥或环境变量引用 ${OPENAI_API_KEY}
  baseUrl?: string;       // 自定义 API 端点
  
  // 提示词
  systemPrompt: string;   // 系统提示词
  taskPromptTemplate?: string;  // 任务提示词模板
  
  // 工具配置
  tools?: string[];       // 允许的工具列表
  mcpServers?: string[];  // 允许的 MCP 服务器
  
  // 资源限制
  maxTokens?: number;     // 最大 token 数
  maxTurns?: number;      // 最大对话轮数
  timeout?: number;       // 超时时间（秒）
  
  // 行为配置
  autoApprove?: boolean;  // 自动批准操作（yolo 模式）
  workingDirectory?: string;  // 工作目录模式
}
```

### 2. 更新 AgentClass 加载逻辑

- 从 `.hydra/classes/` 目录加载配置
- 支持 YAML 和 JSON 格式
- 支持环境变量替换 `${VAR_NAME}`
- 验证必填字段

### 3. 预置 AgentClass 模板

创建几个常用的 AgentClass：

**coder.yaml** - 写代码的 Agent
```yaml
name: coder
role: 代码实现专家
model: gpt-5.2
systemPrompt: |
  你是一个专业的代码实现专家。
  - 严格按照任务文档实现功能
  - 写清晰、可维护的代码
  - 完成后运行测试确保通过
autoApprove: true
```

**reviewer.yaml** - 代码审查 Agent
```yaml
name: reviewer
role: 代码审查专家
model: claude-4
systemPrompt: |
  你是一个代码审查专家。
  - 检查代码质量和潜在问题
  - 提出改进建议
  - 不直接修改代码，只提供反馈
autoApprove: false
```

**architect.yaml** - 架构设计 Agent
```yaml
name: architect
role: 系统架构师
model: gpt-5.2
systemPrompt: |
  你是一个系统架构师。
  - 设计系统架构和模块划分
  - 编写技术文档
  - 拆分任务给其他 Agent
tools:
  - read
  - write
  - web_search
```

### 4. 更新 AgentManager

- spawn 时读取 AgentClass 配置
- 将配置传递给 opencode 进程
- 支持运行时覆盖配置

## 文件变更

- `packages/opencode/src/hydra/agent/class.ts` - 扩展类型定义
- `packages/opencode/src/hydra/agent/manager.ts` - 更新 spawn 逻辑
- `packages/opencode/src/hydra/config/` - 新增配置加载模块
- `.hydra/classes/*.yaml` - 预置模板

## 验收标准

- [ ] AgentClass 支持完整配置
- [ ] 能从 YAML/JSON 加载配置
- [ ] 环境变量替换正常工作
- [ ] 预置模板可用
- [ ] 测试通过
