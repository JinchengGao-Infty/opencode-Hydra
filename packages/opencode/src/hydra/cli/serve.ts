import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createHydraServer } from "../../mcp/hydra-server"

export namespace ServeCommand {
  export async function handler() {
    const server = await createHydraServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
    await new Promise(() => {})
  }
}

