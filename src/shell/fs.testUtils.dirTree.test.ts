import { describe, expect, it } from "bun:test";
import { isNoEntError } from "~/core/errors.js";
import { makeMemoryFs } from "./fs.testUtils.js";

describe("makeMemoryFs directory tree", () => {
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

  it("should throw ENOTDIR when path is a file", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "data");
    let caughtError: unknown;
    try {
      await fs.readdir("/f.txt");
    } catch (e) {
      caughtError = e;
    }
    expect((caughtError as NodeJS.ErrnoException).code).toBe("ENOTDIR");
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

  it("should throw ENOTDIR from readdirWithTypes when path is a file", async () => {
    const fs = makeMemoryFs();
    await fs.writeFile("/f.txt", "data");
    let caughtError: unknown;
    try {
      await fs.readdirWithTypes("/f.txt");
    } catch (e) {
      caughtError = e;
    }
    expect((caughtError as NodeJS.ErrnoException).code).toBe("ENOTDIR");
  });

  it("should snapshot isFile/isDirectory at readdir time, not reflect later mutations", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/d");
    await fs.writeFile("/d/f.txt", "data");
    const entries = await fs.readdirWithTypes("/d");
    const f = entries.find((e) => e.name === "f.txt")!;
    expect(f.isFile()).toBe(true);
    await fs.unlink("/d/f.txt");
    expect(f.isFile()).toBe(true);
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
});
