import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { installAll, type InstallAllDeps } from "./all.js";

const expandPatternsMock =
  mock<(patterns: string[], cwd?: string) => Promise<string[]>>();
const peekFlowMetaMock =
  mock<
    (
      filePath: string,
    ) => Promise<{ name: string | undefined; target: string | undefined }>
  >();
const resolveUniqueEnvDirMock = mock<(files: string[]) => string | undefined>();
const installBrowsersMock =
  mock<
    (
      ctx: CommandContext,
      pattern: string | undefined,
      envDir: string,
    ) => Promise<CommandResult>
  >();
const installAndroidMock =
  mock<
    (
      ctx: CommandContext,
      pattern: string | undefined,
      envDir: string,
    ) => Promise<CommandResult>
  >();

const trackedMocks = [
  expandPatternsMock,
  peekFlowMetaMock,
  resolveUniqueEnvDirMock,
  installBrowsersMock,
  installAndroidMock,
];

afterEach(() => {
  mock.restore();
  for (const m of trackedMocks) m.mockClear();
});

function makeCtx() {
  const messages: { method: string; text: string }[] = [];
  const ctx = {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: "human" as const,
    isInteractive: false,
    ui: {
      info: (m: string) => messages.push({ method: "info", text: m }),
      warn: (m: string) => messages.push({ method: "warn", text: m }),
      success: (m: string) => messages.push({ method: "success", text: m }),
      error: (m: string) => messages.push({ method: "error", text: m }),
    },
  } as unknown as CommandContext;
  return { ctx, messages };
}

function makeDeps(): InstallAllDeps {
  return {
    cwd: "/project",
    expandPatterns: expandPatternsMock,
    peekFlowMeta: peekFlowMetaMock,
    resolveUniqueEnvDir: resolveUniqueEnvDirMock,
    installBrowsers: installBrowsersMock,
    installAndroid: installAndroidMock,
  };
}

beforeEach(() => {
  expandPatternsMock.mockResolvedValue([]);
  peekFlowMetaMock.mockResolvedValue({ name: undefined, target: undefined });
  resolveUniqueEnvDirMock.mockReturnValue(undefined);
  installBrowsersMock.mockResolvedValue(undefined);
  installAndroidMock.mockResolvedValue(undefined);
});

describe("installAll", () => {
  it("should run browsers and android installs when both target types are present", async () => {
    expandPatternsMock.mockResolvedValue(["web.flow.ts", "android.flow.ts"]);
    peekFlowMetaMock
      .mockResolvedValueOnce({ name: undefined, target: "Web - Chrome" })
      .mockResolvedValueOnce({ name: undefined, target: "Android - Pixel 9" });
    const { ctx, messages } = makeCtx();

    const result = await installAll(ctx, undefined, makeDeps());

    expect(installBrowsersMock).toHaveBeenCalledTimes(1);
    expect(installAndroidMock).toHaveBeenCalledTimes(1);
    expect(messages.some((m) => m.method === "success")).toBe(true);
    expect(result).toBeUndefined();
  });

  it("should run only android install when no web flows are present", async () => {
    expandPatternsMock.mockResolvedValue(["android.flow.ts"]);
    peekFlowMetaMock.mockResolvedValue({
      name: undefined,
      target: "Android - Pixel 9",
    });
    const { ctx } = makeCtx();

    await installAll(ctx, undefined, makeDeps());

    expect(installAndroidMock).toHaveBeenCalledTimes(1);
    expect(installBrowsersMock).not.toHaveBeenCalled();
  });

  it("should print skip message and not install when only iOS flows are present", async () => {
    expandPatternsMock.mockResolvedValue(["ios.flow.ts"]);
    peekFlowMetaMock.mockResolvedValue({
      name: undefined,
      target: "iOS - iPad",
    });
    const { ctx, messages } = makeCtx();

    const result = await installAll(ctx, undefined, makeDeps());

    expect(installBrowsersMock).not.toHaveBeenCalled();
    expect(installAndroidMock).not.toHaveBeenCalled();
    expect(
      messages.some((m) => m.method === "warn" && m.text.includes("iOS")),
    ).toBe(true);
    expect(result).toBeUndefined();
  });

  it("should print info and skip installs when no flows are found", async () => {
    expandPatternsMock.mockResolvedValue([]);
    const { ctx, messages } = makeCtx();

    await installAll(ctx, undefined, makeDeps());

    expect(installBrowsersMock).not.toHaveBeenCalled();
    expect(installAndroidMock).not.toHaveBeenCalled();
    expect(messages.some((m) => m.method === "info")).toBe(true);
  });

  it("should warn about iOS and still run browsers when iOS and web flows coexist", async () => {
    expandPatternsMock.mockResolvedValue(["ios.flow.ts", "web.flow.ts"]);
    peekFlowMetaMock
      .mockResolvedValueOnce({ name: undefined, target: "iOS - iPad" })
      .mockResolvedValueOnce({ name: undefined, target: "Web - Chrome" });
    const { ctx, messages } = makeCtx();

    const result = await installAll(ctx, undefined, makeDeps());

    expect(installBrowsersMock).toHaveBeenCalledTimes(1);
    expect(installAndroidMock).not.toHaveBeenCalled();
    expect(
      messages.some((m) => m.method === "warn" && m.text.includes("iOS")),
    ).toBe(true);
    expect(result).toBeUndefined();
  });

  it("should return firstError and still run android when browsers fails", async () => {
    expandPatternsMock.mockResolvedValue(["web.flow.ts", "android.flow.ts"]);
    peekFlowMetaMock
      .mockResolvedValueOnce({ name: undefined, target: "Web - Chrome" })
      .mockResolvedValueOnce({ name: undefined, target: "Android - Pixel 9" });
    installBrowsersMock.mockResolvedValue({
      error: "playwright missing",
      exitCode: 1,
    });
    const { ctx } = makeCtx();

    const result = await installAll(ctx, undefined, makeDeps());

    expect(installBrowsersMock).toHaveBeenCalledTimes(1);
    expect(installAndroidMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: "playwright missing", exitCode: 1 });
  });

  it("should run android and return error when browsers throws", async () => {
    expandPatternsMock.mockResolvedValue(["web.flow.ts", "android.flow.ts"]);
    peekFlowMetaMock
      .mockResolvedValueOnce({ name: undefined, target: "Web - Chrome" })
      .mockResolvedValueOnce({ name: undefined, target: "Android - Pixel 9" });
    installBrowsersMock.mockImplementation(() => {
      throw new Error("Could not find Playwright");
    });
    const { ctx } = makeCtx();

    const result = await installAll(ctx, undefined, makeDeps());

    expect(installAndroidMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: "Could not find Playwright" });
  });

  it("should forward pattern and resolved envDir to both sub-handlers", async () => {
    expandPatternsMock.mockResolvedValue(["web.flow.ts", "android.flow.ts"]);
    peekFlowMetaMock
      .mockResolvedValueOnce({ name: undefined, target: "Web - Chrome" })
      .mockResolvedValueOnce({ name: undefined, target: "Android - Pixel 9" });
    resolveUniqueEnvDirMock.mockReturnValue("/project/.qawolf/staging");
    const { ctx } = makeCtx();

    await installAll(ctx, "src/**", makeDeps());

    expect(installBrowsersMock).toHaveBeenCalledWith(
      ctx,
      "src/**",
      "/project/.qawolf/staging",
    );
    expect(installAndroidMock).toHaveBeenCalledWith(
      ctx,
      "src/**",
      "/project/.qawolf/staging",
    );
  });

  it("should fall back to cwd when no envDir can be resolved from flow files", async () => {
    expandPatternsMock.mockResolvedValue(["web.flow.ts"]);
    peekFlowMetaMock.mockResolvedValue({
      name: undefined,
      target: "Web - Chrome",
    });
    resolveUniqueEnvDirMock.mockReturnValue(undefined);
    const { ctx } = makeCtx();

    await installAll(ctx, undefined, makeDeps());

    expect(installBrowsersMock).toHaveBeenCalledWith(
      ctx,
      undefined,
      "/project",
    );
  });

  it("should return exitCode 2 when flow files span multiple packages", async () => {
    expandPatternsMock.mockResolvedValue([
      ".qawolf/staging/a.flow.ts",
      ".qawolf/prod/b.flow.ts",
    ]);
    resolveUniqueEnvDirMock.mockImplementation(() => {
      throw new Error("Pattern matches flows from 2 packages");
    });
    const { ctx } = makeCtx();

    const result = await installAll(ctx, undefined, makeDeps());

    expect(result).toEqual({
      error: "Pattern matches flows from 2 packages",
      exitCode: 2,
    });
    expect(installBrowsersMock).not.toHaveBeenCalled();
    expect(installAndroidMock).not.toHaveBeenCalled();
  });
});
