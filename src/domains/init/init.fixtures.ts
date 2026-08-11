import type { CommandContext } from "~/shell/commandContext.js";

export function makeCtx(confirmValue = true) {
  const messages: { method: string; text: string }[] = [];
  const ctx = {
    ui: {
      gap: () => {},
      intro: () => {},
      step: (m: string) => messages.push({ method: "step", text: m }),
      info: (m: string) => messages.push({ method: "info", text: m }),
      warn: (m: string) => messages.push({ method: "warn", text: m }),
      outro: () => {},
      confirm: async (_msg: string, opts?: { yes?: boolean }) => {
        if (opts?.yes) return { ok: true, value: true };
        return { ok: true, value: confirmValue };
      },
    },
  } as unknown as CommandContext;
  return { ctx, messages };
}
