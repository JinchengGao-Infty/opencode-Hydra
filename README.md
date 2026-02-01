# OpenCode‑Hydra（社区魔改版）

本仓库是基于上游 OpenCode（`dev` 分支）的 fork，目标是把“Hydra 多 Agent 编排”做成开箱即用的一等能力：Hydra 以内置 MCP Server 运行，并且在 TUI 主界面用 Tab 管理子 Agent（类似 tmux/浏览器标签页）。

## 重要声明（请先读）

- 这是非官方魔改版：与上游 OpenCode 团队无隶属关系，也不代表上游立场。
- 上游项目地址（保留）：
  - GitHub：https://github.com/anomalyco/opencode
  - 官网/文档：https://opencode.ai
- Hydra 不是一个独立发布的开源项目：你无需“先了解 Hydra 再使用”，只需要把它当作本 fork 内置的“多 Agent 任务调度层”,Hydra的前身是本人另一个仓库里面的agent-mux.

## Hydra 是什么?(讲故事版本)

我曾想过单独线性的使用claude code或者codex这种CLI,那遇到并行的任务岂不是太慢了吗?我遇到的任务,经常会遇到5-10并行的时候,比如我需要把某个算法适配到十个数据集上,并且跑通smoke test,如果我为每一个并行的任务单独开一个claude code,那我很快就会乱掉,为什么不能让AI去分配任务给别的AI,然后收集进度合并呢?因此我开始了一系列的尝试,一开始我为claude code写了一个MCP,调用codex,但是没有可视化,众所周知,codex GPT-5.2 xhigh又很慢,这就造成了幽灵AI的现象,即codex带着我的任务潜入赛博空间,直到完成,但是在这个过程中,我无法看到他,无法控制他,无法纠正他.

agent-mux,是我的第二个版本,利用tmux可视化,这个版本很不错,但是我又发现了一个问题,我派遣多个AI的时候,他们会互相打架,codex1改完一个文件,codex2发现自己的任务不兼容了,又会改回去.

于是我想到用gitworktree去隔离,于是Hydra诞生了.给每个子AI文件修改权限,用worktree隔离,主控AI依次审查合并.

但是Hydra只是claude code的MCP,并且依赖tmux,这对Windows用户很不友好,并且我也有抛弃claude code这种闭源工具的想法,做一款真正的AI-IDE.直到我找到了opencode,我将给予这伟大的开源项目最高的赞美.opencode-Hydra,已经是我理想中的AI-IDE的样子了,只是目前只有TUI,没有适配UI界面.但这也足够了.

那么相信聪明的朋友就有问题了,主包主包,我承认你的idea很能提升效率,但是我的钱包问题怎么办?多agent并行,那得多烧token啊?有没有省钱的方案?

有的兄弟,有的!

https://www.right.codes/register?aff=e5763833

向大家推荐一款codex的中转站,便宜,也相对稳定,但因为是中转站,所以不稳定也不要来找我~稳定建议用官方渠道

同时推荐一个claude code中转站

https://foxcode.rjj.cc/auth/register?aff=047WMWC

## Hydra 是什么?(专业版本)
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
