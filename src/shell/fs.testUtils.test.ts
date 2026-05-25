// oxlint-disable eslint/max-lines -- test file covers all makeMemoryFs methods; splitting would fragment related fixtures
import { describe, expect, it } from "bun:test";
import { isNoEntError } from "~/core/errors.js";
import { makeMemoryFs } from "./fs.testUtils.js";

describe("makeMemoryFs", () => {
  it("should write and read back file content", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/file.txt", "hello");
    const result = await fs.readFile("/file.txt");
    expect(result).toBe("hello");
  });

  it("should throw ENOENT when reading a missing file", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.readFile("/missing.txt");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  it("should return true from pathExists after writeFile", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/a");
    await fs.writeFile("/a/b.txt", "data");
    const result = await fs.pathExists("/a/b.txt");
    expect(result).toBe(true);
  });

  it("should return false from pathExists for missing path", async () => {
    const fs = makeMemoryFs();
    const result = await fs.pathExists("/no/such/file");
    expect(result).toBe(false);
  });

  it("should create a directory and report it via pathExists", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/dir");
    const result = await fs.pathExists("/dir");
    expect(result).toBe(true);
  });

  it("should throw ENOENT from non-recursive mkdir when parent does not exist", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.mkdir("/a/b/c");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  it("should remove a file with rm", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/a.txt", "x");
    await fs.rm("/a.txt");
    const result = await fs.pathExists("/a.txt");
    expect(result).toBe(false);
  });

  it("should remove a directory tree with rm recursive", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/dir", { recursive: true });
    await fs.writeFile("/dir/f.txt", "x");
    await fs.rm("/dir", { recursive: true });
    expect(await fs.pathExists("/dir")).toBe(false);
    expect(await fs.pathExists("/dir/f.txt")).toBe(false);
  });

  it("should throw ENOTEMPTY when rm is called without recursive on a non-empty directory", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/d");
    await fs.writeFile("/d/f.txt", "x");
    let caughtError: unknown;
    try {
      await fs.rm("/d");
    } catch (e) {
      caughtError = e;
    }
    expect((caughtError as NodeJS.ErrnoException).code).toBe("ENOTEMPTY");
    expect(await fs.pathExists("/d")).toBe(true);
    expect(await fs.pathExists("/d/f.txt")).toBe(true);
  });

  it("should not throw from rm with force on a missing path", async () => {
    const fs = makeMemoryFs();
    expect(fs.rm("/nope", { force: true })).resolves.toBeUndefined();
  });

  it("should remove a file with unlink", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "y");
    await fs.unlink("/f.txt");
    const result = await fs.pathExists("/f.txt");
    expect(result).toBe(false);
  });

  it("should throw ENOENT from unlink on a missing file", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.unlink("/missing.txt");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  it("should stat an existing file and return isFile true", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/a.txt", "data");
    const stats = await fs.stat("/a.txt");
    expect(stats.isFile()).toBe(true);
    expect(stats.isDirectory()).toBe(false);
  });

  it("should stat an existing directory and return isDirectory true", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/mydir");
    const stats = await fs.stat("/mydir");
    expect(stats.isDirectory()).toBe(true);
    expect(stats.isFile()).toBe(false);
  });

  it("should throw ENOENT from stat on a missing path", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.stat("/missing");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  it("should throw ENOENT when writing to a path whose parent does not exist", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.writeFile("/a/b/c.txt", "data");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  it("should create ancestor directories when recursive mkdir is called", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/x/y/z", { recursive: true });
    expect(await fs.pathExists("/x/y/z")).toBe(true);
    expect(await fs.pathExists("/x/y")).toBe(true);
    expect(await fs.pathExists("/x")).toBe(true);
  });

  // readdir
  it("should return top-level entries when listing root", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/a");
    await fs.writeFile("/b.txt", "");
    const entries = await fs.readdir("/");
    expect(entries.sort()).toEqual(["a", "b.txt"]);
  });

  it("should return direct child names when directory exists", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/a");
    await fs.writeFile("/a/f.txt", "");
    await fs.mkdir("/a/sub");
    const entries = await fs.readdir("/a");
    expect(entries.sort()).toEqual(["f.txt", "sub"]);
  });

  it("should throw ENOENT when directory does not exist", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.readdir("/missing");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  // readdirWithTypes
  it("should return correct types when listing root", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/dir");
    await fs.writeFile("/f.txt", "");
    const entries = await fs.readdirWithTypes("/");
    const d = entries.find((e) => e.name === "dir");
    const f = entries.find((e) => e.name === "f.txt");
    expect(d?.isDirectory()).toBe(true);
    expect(d?.isFile()).toBe(false);
    expect(f?.isFile()).toBe(true);
    expect(f?.isDirectory()).toBe(false);
  });

  it("should return FsDirent with isFile true for files", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/d");
    await fs.writeFile("/d/a.txt", "");
    const entries = await fs.readdirWithTypes("/d");
    const f = entries.find((e) => e.name === "a.txt");
    expect(f?.isFile()).toBe(true);
    expect(f?.isDirectory()).toBe(false);
  });

  it("should return FsDirent with isDirectory true for subdirs", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/p");
    await fs.mkdir("/p/sub");
    const entries = await fs.readdirWithTypes("/p");
    const d = entries.find((e) => e.name === "sub");
    expect(d?.isDirectory()).toBe(true);
    expect(d?.isFile()).toBe(false);
  });

  // rename
  it("should move a file to the new path", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/src.txt", "hello");
    await fs.rename("/src.txt", "/dst.txt");
    expect(await fs.readFile("/dst.txt")).toBe("hello");
    expect(await fs.pathExists("/src.txt")).toBe(false);
  });

  it("should move a directory and its children to the new path", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/src", { recursive: true });
    await fs.writeFile("/src/a.txt", "hello");
    await fs.mkdir("/src/sub");
    await fs.writeFile("/src/sub/b.txt", "world");
    await fs.mkdir("/dst-parent");
    await fs.rename("/src", "/dst-parent/dst");
    expect(await fs.readFile("/dst-parent/dst/a.txt")).toBe("hello");
    expect(await fs.readFile("/dst-parent/dst/sub/b.txt")).toBe("world");
    expect(await fs.pathExists("/src")).toBe(false);
    expect(await fs.pathExists("/src/a.txt")).toBe(false);
  });

  it("should throw ENOENT when renaming a missing path", async () => {
    const fs = makeMemoryFs();
    let caughtError: unknown;
    try {
      await fs.rename("/nope.txt", "/dst.txt");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

  it("should throw ENOENT when renaming a directory to a non-existent parent", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/src");
    let caughtError: unknown;
    try {
      await fs.rename("/src", "/missing/dst");
    } catch (e) {
      caughtError = e;
    }
    expect(isNoEntError(caughtError)).toBe(true);
  });

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

  it("should throw ENOENT when file does not exist", () => {
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
});
