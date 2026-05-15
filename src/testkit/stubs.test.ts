import { describe, expect, it } from "bun:test";
import type { TestkitClient, TestkitPorts } from "@qawolf/testkit/client";
import { configureTestkit } from "./stubs.js";

const fakeClient: TestkitClient = {
  mountCifsShare: () => {
    throw new Error(
      "stub — mountCifsShare should not be called in these tests",
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
      createTestkitClient: (ports: TestkitPorts): TestkitClient => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit(deps);

    expect(() => capturedPorts!.saveSnapshot!("snap", Buffer.from(""))).toThrow(
      "saveBaselineScreenshot is not available in local runs",
    );
  });

  it("should throw 'startOpenVpn is not available in local runs' when startOpenVpn port is called", async () => {
    let capturedPorts: TestkitPorts | undefined;
    const deps = {
      createTestkitClient: (ports: TestkitPorts): TestkitClient => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit(deps);

    expect(() =>
      capturedPorts!.startOpenVpn({ configPath: "/etc/vpn.conf" }),
    ).toThrow("startOpenVpn is not available in local runs");
  });

  it("should throw 'startWireGuard is not available in local runs' when startWireGuard port is called", async () => {
    let capturedPorts: TestkitPorts | undefined;
    const deps = {
      createTestkitClient: (ports: TestkitPorts): TestkitClient => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit(deps);

    expect(() =>
      capturedPorts!.startWireGuard({ configPath: "/etc/wg0.conf" }),
    ).toThrow("startWireGuard is not available in local runs");
  });

  it("should throw 'mountCifsShare is not available in local runs' when mountCifsShare port is called", async () => {
    let capturedPorts: TestkitPorts | undefined;
    const deps = {
      createTestkitClient: (ports: TestkitPorts): TestkitClient => {
        capturedPorts = ports;
        return fakeClient;
      },
      configureTestkitClient: () => {},
    };

    await configureTestkit(deps);

    expect(() =>
      capturedPorts!.mountCifsShare({
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
      createTestkitClient: (_ports: TestkitPorts): TestkitClient => fakeClient,
      configureTestkitClient: (client: TestkitClient) => {
        registeredClient = client;
      },
    };

    await configureTestkit(deps);

    expect(registeredClient).toBe(fakeClient);
  });

  it("should propagate errors thrown by createTestkitClient", async () => {
    const deps = {
      createTestkitClient: (_ports: TestkitPorts): TestkitClient => {
        throw new Error("creation failed");
      },
      configureTestkitClient: () => {},
    };

    let caughtError: unknown;
    try {
      await configureTestkit(deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("creation failed");
  });

  it("should propagate errors thrown by configureTestkitClient", async () => {
    const deps = {
      createTestkitClient: (_ports: TestkitPorts): TestkitClient => fakeClient,
      configureTestkitClient: (): void => {
        throw new Error("registration failed");
      },
    };

    let caughtError: unknown;
    try {
      await configureTestkit(deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("registration failed");
  });
});
