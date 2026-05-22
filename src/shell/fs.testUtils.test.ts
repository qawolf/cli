<<<<<<< HEAD
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
});
