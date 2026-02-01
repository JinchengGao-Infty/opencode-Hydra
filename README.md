[**🇨🇳 简体中文**](./README_zh.md) | [**🇺🇸 English**](./README.md)

# OpenCode-Hydra (Community Modified Version)

This repository is a fork based on upstream OpenCode (`dev` branch). The goal is to make "Hydra Multi-Agent Orchestration" a first-class, out-of-the-box capability: Hydra runs as a built-in MCP Server, and child Agents are managed directly in the TUI main interface using Tabs (similar to tmux or browser tabs).

## Important Notice (Please Read First)

* **Unofficial Fork:** This is an unofficial modified version. It is not affiliated with the upstream OpenCode team and does not represent their stance.
* **Upstream Project (Please Support Original):**
* GitHub: [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
* Official Site/Docs: [https://opencode.ai](https://opencode.ai)


* **Not Standalone:** Hydra is not a standalone open-source project released separately. You don't need to "learn Hydra before using this." Just treat it as the built-in "Multi-Agent Task Scheduling Layer" of this fork. Hydra's predecessor was `agent-mux` from my other repository.

## What is Hydra? (The Story Version)

I once thought about using CLI tools like Claude Code or Codex linearly, but isn't it too slow for parallel tasks? I often encounter situations requiring 5-10 parallel tasks—for example, adapting an algorithm to ten different datasets and running smoke tests for each. If I opened a separate Claude Code instance for every parallel task, I'd lose track immediately. I thought: *Why can't I let an AI assign tasks to other AIs, and then collect and merge the progress?*

So, I started a series of experiments.

Initially, I wrote an MCP for Claude Code to call Codex. However, there was no visualization. As we know, Codex (GPT-5.2 xhigh) is slow. This created the **"Ghost AI"** phenomenon: Codex would dive into cyberspace with my mission, effectively becoming invisible until it finished. During this process, I couldn't see it, control it, or correct it.

`agent-mux` was my second version, utilizing tmux for visualization. It was pretty good, but I discovered another problem: when I dispatched multiple AIs, they would **fight each other**. Codex 1 would modify a file, and Codex 2 would realize its task was no longer compatible and revert the change.

That's when I thought of using **Git Worktree** for isolation. Hydra was born. It grants each child AI file modification permissions but isolates them using worktrees. The Master AI then reviews and merges the changes sequentially.

However, Hydra was just an MCP for Claude Code and relied on tmux, which isn't very friendly for Windows users. I also wanted to move away from closed-source tools like Claude Code and build a real AI-IDE. Then I found **OpenCode**. I give this great open-source project the highest praise. **OpenCode-Hydra** is exactly what I imagined my ideal AI-IDE to look like. Although currently it's only TUI (no GUI yet), it is enough.

Now, smart friends might ask: *"OP, I admit your idea improves efficiency, but what about my wallet? Parallel multi-agent execution burns a lot of tokens. Is there a money-saving solution?"*

**Yes, friends, there is!**

* [https://www.right.codes/register?aff=e5763833](https://www.right.codes/register?aff=e5763833)
*(Recommended Codex relay station. Cheap and relatively stable. But since it's a relay, please don't blame me if it's unstable~ For stability, use official channels.)*
* [https://foxcode.rjj.cc/auth/register?aff=047WMWC](https://foxcode.rjj.cc/auth/register?aff=047WMWC)
*(Recommended Claude Code relay station)*

## What is Hydra? (The Professional Version)

Hydra is used to break down a large goal into parallelizable small tasks and spin up a child Agent to execute each one. You can understand it through three concepts:

* `task`: What needs to be done (can include allowlist/description).
* `class`: Policies for model selection, thinking intensity, timeout, and concurrency.
* `agent`: The actual executor (one task can spawn multiple agents).

In this fork, Hydra functions as `hydra_*` tools called by the Master Agent. Meanwhile, each child Agent appears in the top Tab bar of the TUI. You can switch Tabs to view output, continue the conversation, or control the agent (Pause/Resume/Kill).

## Key Changes vs. Upstream

* **Hydra Built-in MCP Server:** No need to run `hydra serve` separately.
* **TUI Tabs for Child Agents:** Child Agent Tabs do not disappear automatically after completion, allowing for review.
* **Tabs Named by Task:** Reduces the confusion of having a bunch of `codex-*` tabs.
* **Manual Tab Closing:** Click `×` or press `Ctrl+W` (Hides the Tab, does not terminate the task).
* **Interactive Child Agents:** Chat directly in the input box at the bottom of the Child Agent Tab. Provides `Pause/Resume/Kill/Close` controls.
* **Thinking Intensity `xhigh`:** Supports `thinking: low | medium | high | xhigh` (`xhigh` is optimized for GPT/Codex series).
* **Proxy Endpoint Compatibility:** Automatically appends `/v1` to `anthropic`'s `baseURL` to reduce 404 errors.

## Quick Start (Build from Source)

Requirements: Bun + Basic Build Environment (macOS/Linux).

```bash
bun install

# Build (If you encounter Bun crash/Segmentation fault, specify the platform)
bun run --cwd packages/opencode script/build.ts --platform darwin-arm64

# Run (Example: darwin-arm64 build artifact)
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode

```

## Where are the Config Files?

**OpenCode (Master Controller):**

* Global: `~/.config/opencode/opencode.jsonc`
* Project Level (Higher Priority): `./opencode.jsonc` or `./.opencode/opencode.jsonc`

**Hydra (Child Agents & Scheduling):**

* Global: `~/.config/opencode/hydra.yaml`
* Project Level (Higher Priority): `./.hydra/config.yaml`

## TUI: Using it like Browser Tabs

* **Top Tab Bar:** `[ Main ] [ <task-title> ● ] [ <task-title> ○ ] ...`
* **Shortcuts:**
* `Ctrl+0`: Return to `Main`
* `Ctrl+1..9`: Jump to the Nth Agent Tab
* `Tab / Shift+Tab`: Cycle through Tabs
* `Ctrl+P`: Pause
* `Ctrl+R`: Resume
* `Ctrl+K`: Kill
* `Ctrl+W`: Close current Agent Tab (Hide)



## CLI (Optional: For Local Debugging)

```bash
opencode hydra task create "Implement Login" --class Coder --description "..." --allow "src/auth/**"
opencode hydra agent spawn Coder --task <task-id> --thinking xhigh
opencode hydra status

```

## Hydra Configuration Examples

`~/.config/opencode/hydra.yaml`:

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

Project Level `./.hydra/config.yaml` (Custom AgentClass):

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

## Developer Notes

* If you modify `packages/opencode/src/server` routes, regenerate the JS SDK: `./packages/sdk/js/script/build.ts`
* Hydra Documentation (In this repo): `docs/hydra/README.md`, `docs/hydra/TUI-TABS.md`
