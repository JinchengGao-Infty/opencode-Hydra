import type { Argv } from "yargs"
import { HydraCLI } from "../../hydra/cli"
import { cmd } from "./cmd"

export const HydraCommand = cmd({
  command: "hydra",
  describe: "Multi-agent orchestration system",
  builder: (yargs: Argv) => HydraCLI.register(yargs),
  async handler() {},
})

