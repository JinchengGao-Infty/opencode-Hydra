# Task: 实现 TaskManager 任务管理器

## Meta
- id: t002
- status: pending
- priority: P0
- depends: t001
- allow: packages/opencode/src/hydra/**

## Description

实现任务管理器，负责任务的 CRUD 操作和状态管理。

### 1. 文件位置

```
packages/opencode/src/hydra/task/
├── manager.ts    # TaskManager 实现
└── index.ts      # 更新导出
```

### 2. TaskManager 实现 (manager.ts)

```typescript
import { Task } from "./task"
import { TaskParser } from "./parser"
import fs from "fs/promises"
import path from "path"

export namespace TaskManager {
  // 任务目录（相对于项目根目录）
  const TASKS_DIR = ".hydra/tasks"

  /**
   * 初始化任务目录
   */
  export async function init(projectRoot: string): Promise<void>

  /**
   * 创建任务
   * - 生成 ID
   * - 创建 Task 对象
   * - 写入 task.md 文件
   * - 返回创建的任务
   */
  export async function create(projectRoot: string, input: {
    title: string
    description: string
    agentClass?: string
    model?: string
    thinking?: "low" | "medium" | "high"
    allow?: string[]
    timeout?: number
    depends?: string[]
  }): Promise<Task.Info>

  /**
   * 列出所有任务
   * - 读取 TASKS_DIR 下所有 .md 文件
   * - 解析并返回
   * - 支持按状态过滤
   */
  export async function list(projectRoot: string, filter?: {
    status?: Task.Status[]
  }): Promise<Task.Info[]>

  /**
   * 获取单个任务
   */
  export async function get(projectRoot: string, id: string): Promise<Task.Info | undefined>

  /**
   * 更新任务状态
   * - 读取任务
   * - 更新 status 字段
   * - 如果是 running，设置 started
   * - 如果是 done/failed，设置 finished
   * - 写回文件
   */
  export async function updateStatus(
    projectRoot: string, 
    id: string, 
    status: Task.Status
  ): Promise<Task.Info>

  /**
   * 更新任务输出
   * - 读取任务
   * - 更新 output 和 filesChanged
   * - 写回文件
   */
  export async function updateOutput(
    projectRoot: string,
    id: string,
    output: string,
    filesChanged?: string[]
  ): Promise<Task.Info>

  /**
   * 取消任务
   * - 只能取消 pending 或 running 状态的任务
   * - 设置状态为 cancelled
   */
  export async function cancel(projectRoot: string, id: string): Promise<Task.Info>

  /**
   * 获取可执行的任务
   * - 状态为 pending
   * - 所有依赖任务都已完成（done）
   */
  export async function getReady(projectRoot: string): Promise<Task.Info[]>

  /**
   * 获取任务文件路径
   */
  export function getTaskPath(projectRoot: string, id: string): string
}
```

### 3. 辅助函数

```typescript
// 内部辅助函数

/**
 * 检查依赖是否满足
 */
async function checkDependencies(
  projectRoot: string, 
  depends: string[]
): Promise<boolean>

/**
 * 列出任务目录下所有任务文件
 */
async function listTaskFiles(projectRoot: string): Promise<string[]>
```

### 4. 更新导出

```typescript
// packages/opencode/src/hydra/task/index.ts
export * from "./task"
export * from "./parser"
export * from "./manager"
```

## Acceptance Criteria

- [ ] TaskManager.init() 创建 .hydra/tasks 目录
- [ ] TaskManager.create() 创建任务并写入文件
- [ ] TaskManager.list() 列出所有任务，支持状态过滤
- [ ] TaskManager.get() 获取单个任务
- [ ] TaskManager.updateStatus() 正确更新状态和时间戳
- [ ] TaskManager.updateOutput() 正确更新输出
- [ ] TaskManager.cancel() 只能取消 pending/running 任务
- [ ] TaskManager.getReady() 正确检查依赖关系
- [ ] 有单元测试覆盖主要场景

## Notes

- 任务文件命名：`{id}.md`，如 `t001.md`
- 状态更新时自动设置时间戳
- 依赖检查：只有所有依赖任务状态为 done 才算满足
