# Task: 实现 Task 数据结构和解析器

## Meta
- id: t001
- status: pending
- priority: P0
- depends: []
- allow: packages/opencode/src/hydra/**

## Description

实现 Hydra 的任务（Task）模块基础设施，包括数据结构定义和 Markdown 解析器。

### 1. 创建目录结构

```
packages/opencode/src/hydra/
├── index.ts          # 导出
└── task/
    ├── index.ts      # 导出
    ├── task.ts       # Task 数据结构
    └── parser.ts     # 解析/序列化 task.md
```

### 2. Task 数据结构 (task.ts)

使用 Zod 定义：

```typescript
import z from "zod"

export namespace Task {
  export const Status = z.enum(["pending", "running", "done", "failed", "cancelled"])
  export type Status = z.infer<typeof Status>

  export const Meta = z.object({
    id: z.string(),
    status: Status.default("pending"),
    agentClass: z.string().optional(),
    model: z.string().optional(),
    thinking: z.enum(["low", "medium", "high"]).optional(),
    allow: z.array(z.string()).default([]),
    timeout: z.number().optional(),
    depends: z.array(z.string()).default([]),
    created: z.string(),
    started: z.string().optional(),
    finished: z.string().optional(),
  })
  export type Meta = z.infer<typeof Meta>

  export const Info = z.object({
    meta: Meta,
    title: z.string(),
    description: z.string(),
    output: z.string().optional(),
    filesChanged: z.array(z.string()).optional(),
  })
  export type Info = z.infer<typeof Info>

  // 生成任务 ID（时间戳 + 随机）
  export function generateId(): string

  // 创建新任务
  export function create(input: {
    title: string
    description: string
    agentClass?: string
    model?: string
    thinking?: "low" | "medium" | "high"
    allow?: string[]
    timeout?: number
    depends?: string[]
  }): Info
}
```

### 3. Task 解析器 (parser.ts)

解析和序列化 task.md 文件：

```typescript
export namespace TaskParser {
  /**
   * 解析 task.md 内容为 Task.Info
   * 
   * 格式示例：
   * ```markdown
   * # Task: 任务标题
   * 
   * ## Meta
   * - id: t001
   * - status: pending
   * - agentClass: Coder
   * - model: anthropic/claude-sonnet
   * - allow: src/**, tests/**
   * - timeout: 3600
   * - depends: t000
   * - created: 2026-01-31T18:00:00Z
   * 
   * ## Description
   * 任务描述...
   * 
   * ## Output
   * （完成后填写）
   * 
   * ## Files Changed
   * - file1.ts (新建)
   * - file2.ts (修改)
   * ```
   */
  export function parse(content: string): Task.Info

  /**
   * 将 Task.Info 序列化为 Markdown
   */
  export function serialize(task: Task.Info): string

  /**
   * 从文件读取并解析
   */
  export async function readFile(path: string): Promise<Task.Info>

  /**
   * 序列化并写入文件
   */
  export async function writeFile(path: string, task: Task.Info): Promise<void>
}
```

### 4. 导出 (index.ts)

```typescript
// packages/opencode/src/hydra/index.ts
export * from "./task"

// packages/opencode/src/hydra/task/index.ts
export * from "./task"
export * from "./parser"
```

## Acceptance Criteria

- [ ] Task.Status, Task.Meta, Task.Info 类型定义正确
- [ ] Task.generateId() 生成唯一 ID
- [ ] Task.create() 创建新任务对象
- [ ] TaskParser.parse() 能正确解析示例格式的 Markdown
- [ ] TaskParser.serialize() 输出的 Markdown 能被 parse() 正确解析（往返测试）
- [ ] TaskParser.readFile/writeFile 能正确读写文件
- [ ] 有基本的单元测试

## Notes

- 参考 OpenCode 现有的代码风格（Zod schema、命名空间）
- Meta 中的 allow 字段是数组，Markdown 中用逗号分隔
- 时间格式使用 ISO 8601
