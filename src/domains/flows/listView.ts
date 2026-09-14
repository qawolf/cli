import { flowsMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import type { UI } from "~/shell/ui/index.js";

export type ListView = {
  readonly columns: number | undefined;
  readonly interactive: boolean;
};

export const printedView: ListView = { columns: undefined, interactive: false };

export function unavailableView(
  ctx: { readonly ui: Pick<UI, "mode">; readonly isInteractive: boolean },
  view: ListView,
): CommandResult | undefined {
  if (!view.interactive || (ctx.ui.mode === "human" && ctx.isInteractive))
    return undefined;
  return {
    error: flowsMessages.list.interactiveRequiresTerminal,
    exitCode: exitCodes.invalidArgs,
  };
}
