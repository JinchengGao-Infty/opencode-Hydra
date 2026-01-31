# Task: 配置系统

## Meta
- id: t014
- status: pending
- priority: P1
- depends: t011
- allow: packages/opencode/src/hydra/**

## Description

实现 Hydra 配置系统，支持自定义 Agent 类和 API 配置。

### 配置文件

位置：`.hydra/config.yaml`（项目级）或 `~/.config/opencode/hydra.yaml`（全局）

```yaml
# API Provider 配置
providers:
  anthropic:
    endpoint: http://127.0.0.1:3002/kiro/claude
    apiKey: sk-xxx
  openai:
    endpoint: http://127.0.0.1:3002/antigravity/openai
    apiKey: sk-xxx
  google:
    apiKey: xxx

# 内置类覆盖
classes:
  Coder:
    model: anthropic/claude-sonnet      # 覆盖默认模型
    thinking: high                       # 覆盖默认 thinking
    prompt: |                            # 追加 prompt
      额外指令：优先使用 TypeScript

  Architect:
    model: anthropic/claude-opus

# 自定义类
  Tester:
    description: "专门写测试的 Agent"
    model: openai/gpt-5
    thinking: medium
    prompt: |
      你是一个测试专家。
      - 使用 bun:test 框架
      - 覆盖边界条件
      - 写清晰的测试描述

  Reviewer:
    description: "代码审查 Agent"
    model: anthropic/claude-opus
    thinking: high
    prompt: |
      你是代码审查专家。
      - 关注安全问题
      - 检查性能隐患
      - 提出改进建议

# 默认值
defaults:
  model: anthropic/claude-sonnet
  thinking: medium
  timeout: 3600                          # 秒
  maxAgents: 3                           # 最大并行 Agent 数

# 调度配置
scheduler:
  autoStart: false                       # 启动时自动开始调度
  retryOnFail: true                      # 失败后重试
  maxRetries: 2
```

### 实现

1. **配置加载**
   ```typescript
   // src/hydra/config.ts
   export namespace HydraConfig {
     export function load(projectRoot: string): Config
     export function save(projectRoot: string, config: Config): void
     export function get<K extends keyof Config>(key: K): Config[K]
     export function set<K extends keyof Config>(key: K, value: Config[K]): void
   }
   ```

2. **配置合并优先级**
   ```
   spawn 参数 > 项目配置 > 全局配置 > 内置默认
   ```

3. **AgentClass 扩展**
   ```typescript
   // 加载自定义类
   const customClasses = HydraConfig.get("classes")
   AgentClass.register(customClasses)
   
   // spawn 时查找
   const cls = AgentClass.get(className)  // 内置 + 自定义
   ```

4. **Provider 配置**
   ```typescript
   // spawn 时使用配置的 provider
   const provider = HydraConfig.get("providers")[providerName]
   // 传给 opencode run
   ```

### CLI 支持

```bash
# 查看当前配置
opencode hydra config show

# 设置配置项
opencode hydra config set defaults.model openai/gpt-5
opencode hydra config set classes.Coder.thinking high

# 添加自定义类
opencode hydra config add-class MyAgent --model xxx --prompt "..."

# 列出所有 Agent 类（内置 + 自定义）
opencode hydra agent classes
```

## Acceptance Criteria

- [ ] 能读取 `.hydra/config.yaml`
- [ ] 能读取全局配置
- [ ] 配置合并优先级正确
- [ ] 自定义 Agent 类能用
- [ ] Provider 配置生效
- [ ] CLI 能查看和修改配置
- [ ] spawn 时能覆盖配置
