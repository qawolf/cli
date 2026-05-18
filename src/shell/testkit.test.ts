import { describe, expect, it } from "bun:test";
import type {
  TestkitClient,
  TestkitClientWithBaseline,
  TestkitPorts,
} from "@qawolf/testkit/client";
import { configureTestkit } from "./testkit.js";

const fakeClient: TestkitClientWithBaseline = {
  mountCifsShare: () => {
    throw new Error(
      "stub — mountCifsShare should not be called in these tests",
    );
  },
  saveBaselineScreenshot: () => {
    throw new Error(
      "stub — saveBaselineScreenshot should not be called in these tests",
    );
  },
  startOpenVpn: () => {
    throw new Error("stub — startOpenVpn should not be called in these tests");
  },
  startWireGuard: () => {
    throw new Error(
      "stub — startWireGuard should not be called in these tests",
    );
  },
};

describe("configureTestkit", () => {
  it("should throw 'saveBaselineScreenshot is not available in local runs' when saveSnapshot port is called", async () => {
    let capturedPorts: TestkitPorts | undefined;
    const deps = {
      createTestkitClient: (ports: TestkitPorts): TestkitClientWithBaseline => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit("/test", deps);

    if (capturedPorts === undefined)
      throw new Error("createTestkitClient was not called");
    const { saveSnapshot } = capturedPorts;
    if (saveSnapshot === undefined)
      throw new Error("saveSnapshot was not provided to createTestkitClient");
    expect(() => saveSnapshot("snap", Buffer.from(""))).toThrow(
      "saveBaselineScreenshot is not available in local runs",
    );
  });

  it("should throw 'startOpenVpn is not available in local runs' when startOpenVpn port is called", async () => {
    let capturedPorts: TestkitPorts | undefined;
    const deps = {
      createTestkitClient: (ports: TestkitPorts): TestkitClientWithBaseline => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit("/test", deps);

    if (capturedPorts === undefined)
      throw new Error("createTestkitClient was not called");
    const ports = capturedPorts;
    expect(() => ports.startOpenVpn({ configPath: "/etc/vpn.conf" })).toThrow(
      "startOpenVpn is not available in local runs",
    );
  });

  it("should throw 'startWireGuard is not available in local runs' when startWireGuard port is called", async () => {
    let capturedPorts: TestkitPorts | undefined;
    const deps = {
      createTestkitClient: (ports: TestkitPorts): TestkitClientWithBaseline => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit("/test", deps);

    if (capturedPorts === undefined)
      throw new Error("createTestkitClient was not called");
    const ports = capturedPorts;
    expect(() => ports.startWireGuard({ configPath: "/etc/wg0.conf" })).toThrow(
      "startWireGuard is not available in local runs",
    );
  });

  it("should throw 'mountCifsShare is not available in local runs' when mountCifsShare port is called", async () => {
    let capturedPorts: TestkitPorts | undefined;
    const deps = {
      createTestkitClient: (ports: TestkitPorts): TestkitClientWithBaseline => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit("/test", deps);

    if (capturedPorts === undefined)
      throw new Error("createTestkitClient was not called");
    const ports = capturedPorts;
    expect(() =>
      ports.mountCifsShare({
        mountPoint: "/mnt/share",
        password: "secret",
        share: "//fileserver/data",
        username: "alice",
      }),
    ).toThrow("mountCifsShare is not available in local runs");
  });

  it("should register the client returned by createTestkitClient", async () => {
    let registeredClient: TestkitClient | undefined;
    const deps = {
      createTestkitClient: (_ports: TestkitPorts): TestkitClientWithBaseline =>
        fakeClient,
      configureTestkitClient: (client: TestkitClient) => {
        registeredClient = client;
      },
    };

    await configureTestkit("/test", deps);

    expect(registeredClient).toBe(fakeClient);
  });

  it("should propagate errors thrown by createTestkitClient", async () => {
    const deps = {
      createTestkitClient: (
        _ports: TestkitPorts,
      ): TestkitClientWithBaseline => {
        throw new Error("creation failed");
      },
      configureTestkitClient: () => {},
    };

    let caughtError: unknown;
    try {
      await configureTestkit("/test", deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("creation failed");
  });

  it("should propagate errors thrown by configureTestkitClient", async () => {
    const deps = {
      createTestkitClient: (_ports: TestkitPorts): TestkitClientWithBaseline =>
        fakeClient,
      configureTestkitClient: (): void => {
        throw new Error("registration failed");
      },
    };

    let caughtError: unknown;
    try {
      await configureTestkit("/test", deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("registration failed");
  });
});
