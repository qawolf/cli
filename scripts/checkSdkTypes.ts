#!/usr/bin/env bun
// Fails when the published SDK declarations reference anything outside
// themselves. `~/` is a tsconfig alias and `../` reaches files that are not
// published, so either would leave a consumer with types that do not resolve.
import { readFileSync } from "node:fs";

const published = [
  "dist/types/runnerSdk/index.d.ts",
  "dist/types/runnerSdk/types.d.ts",
];

const allowed = /^(\.\/types\.js|@qawolf\/api-contracts\/v1)$/;

const leaks = published.flatMap((file) => {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/from "([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((specifier) => !allowed.test(specifier))
    .map((specifier) => `${file} imports ${specifier}`);
});

if (leaks.length > 0) {
  console.error(
    `The published SDK types reach outside themselves:\n${leaks.map((leak) => `  ${leak}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(`Checked ${published.length} published declaration files.`);
