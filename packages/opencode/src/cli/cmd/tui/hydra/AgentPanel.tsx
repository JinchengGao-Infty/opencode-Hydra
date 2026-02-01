import { Match, Show, Switch } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { AgentInstance } from "@/hydra/agent"
import { AgentStatus } from "./AgentStatus"

export function AgentPanel(props: {
  agent?: AgentInstance.Info
  task?: string
  log?: string
  onPause: () => void
  onResume: () => void
  onKill: () => void
  onClose: () => void
}) {
  const { theme } = useTheme()

  return (
    <box flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} gap={1}>
      <Switch>
        <Match when={props.agent}>
          {(agent) => (
            <>
              <box flexDirection="row" gap={1} flexShrink={0}>
                <text attributes={TextAttributes.BOLD} fg={theme.text}>
                  {agent().name}
                </text>
                <AgentStatus status={agent().status} />
                <Show when={agent().taskId}>
                  {(taskId) => (
                    <text fg={theme.textMuted}>
                      - Task: {taskId()}
                      <Show when={props.task}>
                        <span style={{ fg: theme.text }}> {props.task}</span>
                      </Show>
                    </text>
                  )}
                </Show>
                <box flexGrow={1} justifyContent="flex-end" flexDirection="row" gap={1}>
                  <text fg={theme.textMuted} onMouseUp={() => props.onPause()}>
                    [Pause]
                  </text>
                  <text fg={theme.textMuted} onMouseUp={() => props.onResume()}>
                    [Resume]
                  </text>
                  <text fg={theme.textMuted} onMouseUp={() => props.onKill()}>
                    [Kill]
                  </text>
                  <text fg={theme.textMuted} onMouseUp={() => props.onClose()}>
                    [Close]
                  </text>
                </box>
              </box>
              <scrollbox stickyScroll={true} stickyStart="bottom" flexGrow={1}>
                <Switch>
                  <Match when={props.log && props.log.trim().length > 0}>
                    <text fg={theme.text}>{props.log}</text>
                  </Match>
                  <Match when={true}>
                    <text fg={theme.textMuted}>No output yet.</text>
                  </Match>
                </Switch>
              </scrollbox>
            </>
          )}
        </Match>
        <Match when={true}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>Select an agent tab to view output.</text>
            <text fg={theme.textMuted}>
              Tab / Shift+Tab to switch • Ctrl+1..9 to jump • Ctrl+P pause • Ctrl+R resume • Ctrl+K kill
            </text>
          </box>
        </Match>
      </Switch>
    </box>
  )
}
