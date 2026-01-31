# Task: 实现 AgentClass 类系统

## Meta
- id: t003
- status: pending
- priority: P1
- depends: t001
- allow: packages/opencode/src/hydra/**

## Description

实现 Agent 类系统，支持预设类和用户自定义类。

### 1. 文件位置

```
packages/opencode/src/hydra/
├── agent/
│   ├── index.ts      # 导出
│   ├── class.ts      # AgentClass 定义
│   └── prompts/      # 内置类的 prompt 文件
│       ├── coder.txt
│       ├── architect.txt
│       ├── writer.txt
│       └── reviewer.txt
└── index.ts          # 更新导出
```

### 2. AgentClass 数据结构 (class.ts)

```typescript
import z from "zod"
import fs from "fs/promises"
import path from "path"
import yaml from "yaml"

// 内置 prompt
import PROMPT_CODER from "./prompts/coder.txt"
import PROMPT_ARCHITECT from "./prompts/architect.txt"
import PROMPT_WRITER from "./prompts/writer.txt"
import PROMPT_REVIEWER from "./prompts/reviewer.txt"

export namespace AgentClass {
  export const Thinking = z.enum(["low", "medium", "high"])
  export type Thinking = z.infer<typeof Thinking>

  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    prompt: z.string(),
    defaultModel: z.string(),
    defaultThinking: Thinking,
  })
  export type Info = z.infer<typeof Info>

  /**
   * 内置 Agent 类
   */
  export const BUILTIN: Record<string, Info> = {
    Coder: {
      name: "Coder",
      description: "写代码的 Agent，擅长实现功能、修复 bug、写测试",
      prompt: PROMPT_CODER,
      defaultModel: "anthropic/claude-sonnet",
      defaultThinking: "medium",
    },
    Architect: {
      name: "Architect",
      description: "架构设计 Agent，擅长系统设计、技术选型、代码审查",
      prompt: PROMPT_ARCHITECT,
      defaultModel: "anthropic/claude-opus",
      defaultThinking: "high",
    },
    Writer: {
      name: "Writer",
      description: "文档 Agent，擅长写文档、注释、README",
      prompt: PROMPT_WRITER,
      defaultModel: "google/gemini-2",
      defaultThinking: "low",
    },
    Reviewer: {
      name: "Reviewer",
      description: "代码审查 Agent，擅长发现问题、提出改进建议",
      prompt: PROMPT_REVIEWER,
      defaultModel: "anthropic/claude-opus",
      defaultThinking: "high",
    },
  }

  /**
   * 从项目配置加载自定义类
   * 配置文件：.hydra/agents.yaml
   */
  export async function loadCustom(projectRoot: string): Promise<Record<string, Info>>

  /**
   * 获取所有类（内置 + 自定义）
   */
  export async function list(projectRoot: string): Promise<Info[]>

  /**
   * 获取指定类
   * 优先返回自定义类，其次内置类
   */
  export async function get(projectRoot: string, name: string): Promise<Info | undefined>

  /**
   * 检查类是否存在
   */
  export async function exists(projectRoot: string, name: string): Promise<boolean>
}
```

### 3. 内置 Prompt 文件

**prompts/coder.txt**:
```
你是一个专业的程序员。

## 工作原则
1. 遵循项目现有的代码风格和约定
2. 写清晰、可维护的代码
3. 添加必要的注释，但不要过度注释
4. 为新功能编写单元测试
5. 处理边界情况和错误

## 工作流程
1. 先理解任务需求
2. 探索相关代码，了解上下文
3. 制定实现计划
4. 逐步实现，每步验证
5. 运行测试确保没有破坏现有功能
6. 完成后总结所做的更改

## 注意事项
- 不要删除或修改与任务无关的代码
- 如果不确定，先在日志中记录问题，等待指示
- 保持提交粒度合理，一个功能一个提交
```

**prompts/architect.txt**:
```
你是一个资深软件架构师。

## 工作原则
1. 关注系统的可扩展性和可维护性
2. 考虑性能和安全性
3. 遵循 SOLID 原则和设计模式
4. 保持架构简洁，避免过度设计

## 工作流程
1. 深入理解需求和约束
2. 分析现有架构
3. 提出设计方案，说明权衡
4. 如果需要重构，制定渐进式计划
5. 审查代码时关注架构一致性

## 注意事项
- 大的架构变更需要先讨论
- 记录架构决策和理由
- 考虑向后兼容性
```

**prompts/writer.txt**:
```
你是一个技术文档专家。

## 工作原则
1. 文档要清晰、准确、易懂
2. 使用恰当的示例
3. 保持结构合理
4. 考虑读者背景

## 工作流程
1. 理解要文档化的内容
2. 确定目标读者
3. 组织文档结构
4. 编写内容，添加示例
5. 检查拼写和格式

## 文档类型
- README：项目概述、快速开始
- API 文档：接口说明、参数、返回值
- 教程：步骤式指南
- 注释：代码内说明
```

**prompts/reviewer.txt**:
```
你是一个严格的代码审查员。

## 审查重点
1. 代码正确性：逻辑是否正确
2. 代码质量：可读性、可维护性
3. 安全性：是否有安全漏洞
4. 性能：是否有性能问题
5. 测试：测试是否充分

## 工作流程
1. 理解变更的目的
2. 逐文件审查
3. 记录发现的问题
4. 提出改进建议
5. 总结审查结果

## 反馈原则
- 具体指出问题位置
- 解释为什么是问题
- 提供改进建议
- 区分必须修复和建议改进
```

### 4. 自定义类配置格式

**.hydra/agents.yaml**:
```yaml
classes:
  CustomAgent:
    description: "自定义 Agent 描述"
    prompt: |
      你是一个自定义 Agent...
    defaultModel: openai/gpt-5
    defaultThinking: high
    
  AnotherAgent:
    description: "另一个自定义 Agent"
    prompt: |
      ...
    defaultModel: anthropic/claude-sonnet
    defaultThinking: medium
```

## Acceptance Criteria

- [ ] AgentClass.Info schema 定义正确
- [ ] 4 个内置类（Coder, Architect, Writer, Reviewer）定义完整
- [ ] 每个内置类有对应的 prompt 文件
- [ ] AgentClass.loadCustom() 能正确解析 .hydra/agents.yaml
- [ ] AgentClass.list() 返回内置 + 自定义类
- [ ] AgentClass.get() 优先返回自定义类
- [ ] 配置文件不存在时不报错，返回空
- [ ] 有单元测试

## Notes

- prompt 文件使用 .txt 后缀，通过 import 导入
- 自定义类可以覆盖内置类（同名时优先自定义）
- yaml 解析使用 `yaml` 包
