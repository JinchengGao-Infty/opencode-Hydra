# OpenCode‑Hydra（社区魔改版）

本仓库是基于上游 OpenCode（`dev` 分支）的 fork，目标是把“Hydra 多 Agent 编排”做成开箱即用的一等能力：Hydra 以内置 MCP Server 运行，并且在 TUI 主界面用 Tab 管理子 Agent（类似 tmux/浏览器标签页）。

## 重要声明（请先读）

- 这是非官方魔改版：与上游 OpenCode 团队无隶属关系，也不代表上游立场。
- 上游项目地址（保留）：
  - GitHub：https://github.com/anomalyco/opencode
  - 官网/文档：https://opencode.ai
- Hydra 不是一个独立发布的开源项目：你无需“先了解 Hydra 再使用”，只需要把它当作本 fork 内置的“多 Agent 任务调度层”。

## Hydra 是什么（给没接触过的人）

Hydra 用来把一个大目标拆成可并行的小任务，并为每个任务拉起一个子 Agent 执行。你可以把它理解为三个概念：

- `task`：要做什么（可带 allowlist/描述）
- `class`：用什么模型、思考强度、超时/并发等策略
- `agent`：实际执行者（一个 task 可以生成多个 agent）

在本 fork 里，Hydra 会以 `hydra_*` 工具形式被主控调用；同时每个子 Agent 会出现在 TUI 顶部 Tab 栏，你可以切换 Tab 查看输出、继续对话或控制（Pause/Resume/Kill）。

## 这版相对上游的主要改动

- **Hydra 内置 MCP server**：不需要单独跑 `hydra serve`。
- **主界面 Tabs 管理子 Agent**：子 Agent Tab 完成后不会自动消失，可回看。
- **Tab 名称跟随任务标题**：减少一堆 `codex-*` 的混乱。
- **Tab 可手动关闭**：点击 `×` 或 `Ctrl+W`（只隐藏 Tab，不会终止任务）。
- **子 Agent 可交互**：在子 Agent Tab 底部输入框直接对话，并提供 `Pause/Resume/Kill/Close` 控制。
- **思考强度支持 `xhigh`**：`thinking: low | medium | high | xhigh`（`xhigh` 适用于 GPT/Codex 系列）。
- **代理端点兼容**：`anthropic` 的 `baseURL` 会自动补齐 `/v1`，减少 404。

## 快速开始（本仓库开发构建）

需要：Bun + 基础构建环境（macOS/Linux）。

```bash
bun install

# 编译（若遇到 Bun 崩溃/Segmentation fault，优先指定平台）
bun run --cwd packages/opencode script/build.ts --platform darwin-arm64

# 运行（示例：darwin-arm64 构建产物）
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode
```

## 配置文件在哪？

OpenCode（主控）：
- 全局：`~/.config/opencode/opencode.jsonc`
- 项目级（优先级更高）：`./opencode.jsonc` 或 `./.opencode/opencode.jsonc`

Hydra（子 Agent 与调度）：
- 全局：`~/.config/opencode/hydra.yaml`
- 项目级（优先级更高）：`./.hydra/config.yaml`

> 不要把任何 `apiKey` 提交到 Git。建议只写在本机的 `~/.config` 下。

## TUI：怎么“像标签页一样”用

- 顶部 Tab：`[ Main ] [ <task-title> ● ] [ <task-title> ○ ] ...`
- 常用快捷键：
  - `Ctrl+0`：回到 `Main`
  - `Ctrl+1..9`：跳到第 N 个 Agent Tab
  - `Tab / Shift+Tab`：循环切换 Tab
  - `Ctrl+P`：Pause
  - `Ctrl+R`：Resume
  - `Ctrl+K`：Kill
  - `Ctrl+W`：关闭当前 Agent Tab（隐藏）

## CLI（可选：方便本地调试 Hydra）

```bash
opencode hydra task create "实现登录" --class Coder --description "..." --allow "src/auth/**"
opencode hydra agent spawn Coder --task <task-id> --thinking xhigh
opencode hydra status
```

## Hydra 配置示例

`~/.config/opencode/hydra.yaml`：

```yaml
providers:
  openai:
    apiKey: YOUR_KEY
    endpoint: https://api.openai.com/v1
  anthropic:
    apiKey: YOUR_KEY

defaults:
  model: openai/gpt-5.2
  thinking: xhigh
```

项目级 `./.hydra/config.yaml`（自定义 AgentClass）：

```yaml
defaults:
  model: openai/gpt-5.2
  thinking: xhigh
  timeout: 3600
  maxAgents: 3

classes:
  Codex:
    model: openai/gpt-5.2
    thinking: xhigh
```

## 开发者说明

- 改了 `packages/opencode/src/server` 路由后，重新生成 JS SDK：`./packages/sdk/js/script/build.ts`
- Hydra 文档（本仓库）：`docs/hydra/README.md`、`docs/hydra/TUI-TABS.md`
