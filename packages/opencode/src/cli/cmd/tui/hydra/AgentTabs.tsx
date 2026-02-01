import { createMemo, For, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { AgentStatus } from "./AgentStatus"
import { AgentInstance } from "@/hydra/agent"

export function AgentTabs(props: {
  tab: "main" | string
  agents: AgentInstance.Info[]
  tasks: Record<string, string>
  onSelect: (id: "main" | string) => void
  onClose: (id: string) => void
}) {
  const { theme } = useTheme()

  const running = createMemo(() => props.agents.filter((x) => x.status === "running").length)
  const waiting = createMemo(() => props.agents.filter((x) => x.status === "waiting").length)
  const paused = createMemo(() => props.agents.filter((x) => x.status === "paused").length)

  const Summary = (
    <text fg={theme.textMuted}>
      Agents:{" "}
      <span style={{ fg: theme.success }}>{running()} running</span>
      <Show when={waiting() > 0}>
        <span>
          {" "}
          / <span style={{ fg: theme.warning }}>{waiting()} waiting</span>
        </span>
      </Show>
      <Show when={paused() > 0}>
        <span>
          {" "}
          / <span style={{ fg: theme.error }}>{paused()} paused</span>
        </span>
      </Show>
    </text>
  )

  const title = (agent: AgentInstance.Info) => {
    if (!agent.taskId) return agent.name
    const task = props.tasks[agent.taskId]
    if (!task) return agent.name
    return task
  }

  const trim = (text: string, max: number) => {
    if (text.length <= max) return text
    return text.slice(0, Math.max(1, max - 1)) + "…"
  }

  const Tab = (input: { id: "main" | string; title: string; status?: AgentInstance.Status }) => {
    const active = createMemo(() => props.tab === input.id)
    return (
      <box
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={active() ? theme.backgroundElement : undefined}
        onMouseUp={() => props.onSelect(input.id)}
      >
        <box flexDirection="row" gap={1}>
          <Show when={input.status}>
            {(status) => <AgentStatus status={status()} label={false} />}
          </Show>
          <text fg={active() ? theme.text : theme.textMuted}>[{trim(input.title, 22)}]</text>
          <Show when={input.id !== "main"}>
            <text fg={theme.textMuted} onMouseUp={() => props.onClose(String(input.id))}>
              ×
            </text>
          </Show>
        </box>
      </box>
    )
  }

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      flexShrink={0}
      backgroundColor={theme.backgroundPanel}
    >
      <box flexDirection="row" gap={1}>
        <Tab id="main" title="Main" />
        <For each={props.agents}>{(agent) => <Tab id={agent.id} title={title(agent)} status={agent.status} />}</For>
      </box>
      <box flexShrink={0}>{Summary}</box>
    </box>
  )
}
