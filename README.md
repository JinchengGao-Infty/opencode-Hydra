# OpenCode‑Hydra（魔改版）

这是一个基于 OpenCode `dev` 分支的开发版 Fork，核心目标是把 **Hydra 多 Agent 编排**变成“开箱即用”的一等能力：**内置 MCP Server + 主界面 Tab 管理子 AI**（像 tmux/浏览器标签页一样）。

## 这版和原版的差异

- **Hydra 作为内置 MCP server**：不需要单独跑 `hydra serve`，主控可直接调用 `hydra_*` 工具。
- **主界面 Tab 管理子 AI**：子 Agent 直接出现在主聊天界面的顶部 Tab 栏；完成后 Tab 不会消失，支持回看。
- **Tab 名称跟随任务**：优先展示绑定任务的标题，避免一堆 `codex-*` 分不清。
- **Tab 可手动关闭**：点击 Tab 上的 `×` 或在 Agent 视图按 `Ctrl+W`（只隐藏，不会终止任务）。
- **子 Agent 可交互**：在子 Agent Tab 底部输入框直接对话；并提供 `Pause/Resume/Kill/Close` 控制。
- **更强的思考强度**：Hydra `thinking` 支持 `low | medium | high | xhigh`（`xhigh` 适用于 GPT/Codex 系列）。
- **兼容更多代理端点**：对 `anthropic` 的 `baseURL` 自动补齐 `/v1`（避免代理端点路径不一致导致 404）。

## 快速开始（本仓库开发构建）

> 需要：Bun（建议与仓库声明版本接近），以及 macOS/Linux 的基础构建环境。

```bash
# 1) 安装依赖
bun install

# 2) 编译（如果你遇到 Bun 崩溃/Segmentation fault，优先用 --platform）
bun run --cwd packages/opencode script/build.ts --platform darwin-arm64

# 3) 运行
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode
```

## 配置文件在哪里？

OpenCode（主控）：
- 全局：`~/.config/opencode/opencode.jsonc`
- 项目级（优先级更高）：`./opencode.jsonc` 或 `./.opencode/opencode.jsonc`

Hydra（子 AI 与调度）：
- 全局：`~/.config/opencode/hydra.yaml`
- 项目级（优先级更高）：`./.hydra/config.yaml`

> 注意：不要把任何 `apiKey` 提交到 Git。建议只在本机配置里写 key。

## Hydra 用法（TUI + CLI）

### 1) TUI 主界面 Tab

- 顶部 Tab：`[ Main ] [ <task-title> ● ] [ <task-title> ○ ] ...`
- 快捷键：
  - `Ctrl+1..9`：跳到第 N 个 Agent Tab
  - `Ctrl+0`：回到 `Main`
  - `Tab / Shift+Tab`：循环切换 Agent Tab
  - `Ctrl+P`：Pause
  - `Ctrl+R`：Resume
  - `Ctrl+K`：Kill
  - `Ctrl+W`：关闭当前 Agent Tab（隐藏）

### 2) CLI（方便本地调试）

```bash
# 创建任务
opencode hydra task create "实现登录" --class Coder --description "..." --allow "src/auth/**"

# 启动 Agent 执行任务
opencode hydra agent spawn Coder --task <task-id> --thinking xhigh

# 查看状态
opencode hydra status
```

## Hydra 配置示例

`~/.config/opencode/hydra.yaml`（给子 AI 注入 provider 信息）：

```yaml
providers:
  openai:
    apiKey: YOUR_KEY
    endpoint: https://api.openai.com/v1
  anthropic:
    apiKey: YOUR_KEY
    # endpoint/baseURL 可写可不写（本 fork 会自动处理 /v1 兼容）

defaults:
  model: openai/gpt-5.2
  thinking: xhigh
```

项目级 `.hydra/config.yaml`（自定义 AgentClass）：

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

- 如果你改了 `packages/opencode/src/server` 的路由，记得重新生成 JS SDK：`./packages/sdk/js/script/build.ts`

## 更多文档

- OpenCode 配置文档：https://opencode.ai/docs
- 本 fork 的 Hydra 文档：`docs/hydra/README.md`、`docs/hydra/TUI-TABS.md`

## 贡献

欢迎 PR。提交前请先阅读：`CONTRIBUTING.md`

## 命名与归属声明

如果你基于 OpenCode 做了衍生项目，并且项目名包含 `opencode`（例如 `opencode-dashboard` / `opencode-mobile`），请在你的 README 里注明：该项目并非 OpenCode 团队官方出品，也不与其存在隶属关系。

## FAQ：和 Claude Code 有什么不同？

整体能力接近，但 OpenCode 的差异点是：

- 100% 开源
- Provider 无绑定：可用 Claude/OpenAI/Google/本地模型等（推荐可选 OpenCode Zen：https://opencode.ai/zen）
- 开箱即用的 LSP 支持
- 更专注 TUI：由 neovim 用户与 terminal.shop 团队打造，持续探索终端交互上限
- Client/Server 架构：主控可跑在本机，前端可替换（TUI 只是其中一种客户端形态）

---

加入社区：Discord https://discord.gg/opencode ｜ X https://x.com/opencode
