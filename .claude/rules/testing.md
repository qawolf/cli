---
description: bun:test patterns and quirks for writing tests
globs: src/**/*.test.ts
---

## bun:test patterns

**`rejects.toThrow` does not need `await` — unless you depend on the promise settling.**

`expect(promise).rejects.toThrow("msg")` returns `undefined` at runtime (not a
Promise). Bun evaluates the assertion internally, so `await` is unnecessary and
triggers both a TS language server warning (`'await' has no effect`) and an
oxlint `await-thenable` warning.

However, if you have assertions after the call that depend on side effects from
the async chain (e.g. spy call counts), omitting `await` means those assertions
run before the promise settles. In that case, use try-catch to await the call
directly:

```ts
let caughtError: unknown;
try {
  await fnThatRejects();
} catch (e) {
  caughtError = e;
}
expect(caughtError).toBeInstanceOf(Error);
expect((caughtError as Error).message).toBe("expected message");
// dependent assertions here run after the async chain has settled
```

**`spyOn` requires `afterEach(() => mock.restore())` for cleanup.**

`mock.restore()` is the bun:test equivalent of `vi.restoreAllMocks()` — it restores both `spyOn()` spies and `mock()` fakes. Any test file using `spyOn` must include this teardown:

```ts
import { afterEach, mock, spyOn } from "bun:test";

afterEach(() => {
  mock.restore();
});
```

Without it, spy implementations leak across tests in the same file.
