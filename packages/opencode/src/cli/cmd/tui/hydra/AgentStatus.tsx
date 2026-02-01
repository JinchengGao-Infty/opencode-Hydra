import { createMemo, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { AgentInstance } from "@/hydra/agent"

export function AgentStatus(props: { status: AgentInstance.Status; label?: boolean }) {
  const { theme } = useTheme()

  const dot = createMemo(() => {
    if (props.status === "done") return "○"
    if (props.status === "failed") return "○"
    return "●"
  })

  const item = createMemo(() => {
    if (props.status === "running") return { fg: theme.success, text: "running" }
    if (props.status === "waiting") return { fg: theme.warning, text: "waiting" }
    if (props.status === "paused") return { fg: theme.error, text: "paused" }
    if (props.status === "done") return { fg: theme.success, text: "done" }
    if (props.status === "failed") return { fg: theme.error, text: "failed" }
    return { fg: theme.textMuted, text: props.status }
  })

  return (
    <text fg={theme.textMuted}>
      <span style={{ fg: item().fg }}>{dot()}</span>
      <Show when={props.label !== false}>
        <span> {item().text}</span>
      </Show>
    </text>
  )
}
