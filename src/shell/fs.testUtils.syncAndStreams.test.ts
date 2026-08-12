import { describe, expect, it } from "bun:test";
import { isNoEntError } from "~/core/errors.js";
import { makeMemoryFs } from "./fs.testUtils.js";

describe("makeMemoryFs sync methods, streams, and write handles", () => {
  // existsSync
  it("should return true for an existing file", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "");
    expect(fs.existsSync("/f.txt")).toBe(true);
  });

  it("should return false for a missing path", () => {
    const fs = makeMemoryFs();
    expect(fs.existsSync("/nowhere")).toBe(false);
  });

  // readFileSync
  it("should return file content as string", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "content");
    expect(fs.readFileSync("/f.txt")).toBe("content");
  });

  it("should throw ENOENT when file does not exist", () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      fs.readFileSync("/missing.txt");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  // mkdirSync
  it("should create a directory synchronously", () => {
    const fs = makeMemoryFs();
    fs.mkdirSync("/d");
    expect(fs.existsSync("/d")).toBe(true);
  });

  it("should throw ENOENT for non-recursive when parent does not exist", () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      fs.mkdirSync("/a/b/c");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  it("should create all ancestors when recursive is true", () => {
    const fs = makeMemoryFs();
    fs.mkdirSync("/a/b/c", { recursive: true });
    expect(fs.existsSync("/a")).toBe(true);
    expect(fs.existsSync("/a/b")).toBe(true);
    expect(fs.existsSync("/a/b/c")).toBe(true);
  });

  // writeFileSync
  it("should write a file synchronously, readable via readFileSync", () => {
    const fs = makeMemoryFs();
    fs.writeFileSync("/f.txt", "hello");
    expect(fs.readFileSync("/f.txt")).toBe("hello");
  });

  it("should throw ENOENT when the parent directory does not exist", () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      fs.writeFileSync("/missing/f.txt", "data");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  // createReadStream
  it("should stream file content through data events", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "hello");
    const stream = fs.createReadStream("/f.txt");
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    expect(Buffer.concat(chunks).toString()).toBe("hello");
  });

  it("should throw ENOENT when streaming a file that does not exist", () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      fs.createReadStream("/missing.txt");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  // utimes
  it("should resolve without error", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "");
    expect(
      fs.utimes("/f.txt", new Date(), new Date()),
    ).resolves.toBeUndefined();
  });

  // mkdir with mode option
  it("should create directory when mode option is provided", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/d", { recursive: true, mode: 0o700 });
    expect(await fs.pathExists("/d")).toBe(true);
  });

  // writeFile with options
  it("should write file when mode option is provided", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/d");
    await fs.writeFile("/d/f.txt", "data", { mode: 0o600 });
    expect(await fs.readFile("/d/f.txt")).toBe("data");
  });

  // Path keying — tests build paths with a literal "/" while the code under
  // test joins with node:path, which emits "\" and a drive prefix on win32.
  it("should name the same entry from a win32-separated path as from its POSIX form", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/a/b", { recursive: true });
    await fs.writeFile("\\a\\b\\f.txt", "data");
    expect(await fs.readFile("/a/b/f.txt")).toBe("data");
  });

  it("should name the same entry from a drive-qualified path as from its POSIX form", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/a", { recursive: true });
    await fs.writeFile("C:\\a\\f.txt", "data");
    expect(await fs.readFile("/a/f.txt")).toBe("data");
  });

  it("should list a win32-separated write through a POSIX readdir", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("\\x\\y", { recursive: true });
    await fs.writeFile("\\x\\y\\f.txt", "data");
    expect(await fs.readdir("/x/y")).toEqual(["f.txt"]);
    expect(await fs.pathExists("/x")).toBe(true);
  });

  it("should accumulate write-handle chunks into the file across close", async () => {
    const fs = makeMemoryFs();
    const encoder = new TextEncoder();
    const handle = await fs.openWriteHandle("/streamed.bin");
    await handle.write(encoder.encode("abc"));
    await handle.write(encoder.encode("def"));
    await handle.close();
    expect(await fs.readFile("/streamed.bin")).toBe("abcdef");
  });

  it("should replace existing content when a write handle opens the path", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "old content");
    const handle = await fs.openWriteHandle("/f.txt");
    await handle.write(new TextEncoder().encode("new"));
    await handle.close();
    expect(await fs.readFile("/f.txt")).toBe("new");
  });

  it("should throw ENOENT when a write handle opens under a missing parent", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.openWriteHandle("/no/such/dir/f.bin");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });
});
