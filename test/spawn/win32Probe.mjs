// Temporary probe for WIZ-11286 and WIZ-11287. Delete once both are settled.
// Reports observations only; never fails the job.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, sep } from "node:path";
import { glob } from "tinyglobby";

function section(name) {
  console.log(`\n=== ${name} ===`);
}

// WIZ-11286: does CreateProcess reach playwright.exe when handed an
// extension-less POSIX shim path, or does it fail?
async function probeExtensionlessShim() {
  section("WIZ-11286 extension-less shim");
  const root = await mkdtemp(join(tmpdir(), "wiz11286-"));
  const binDir = join(root, "node_modules", ".bin");
  await mkdir(binDir, { recursive: true });
  const shim = join(binDir, "playwright");
  await writeFile(shim, "#!/bin/sh\necho posix-shim-ran\n");

  console.log("shim path:", shim);
  console.log("first line:", (await readFile(shim, "utf8")).split("\n")[0]);

  const result = await new Promise((resolve) => {
    const child = spawn(shim, ["--version"], { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", (error) =>
      resolve({
        outcome: "error",
        code: error.code,
        errno: error.errno,
        message: error.message,
      }),
    );
    child.on("close", (exitCode) =>
      resolve({ outcome: "close", exitCode, stdout, stderr }),
    );
  });
  console.log("spawn result:", JSON.stringify(result));

  // Control: the same directory with a real .exe present, to confirm the probe
  // above is measuring the extension-less path and not a missing-file error.
  console.log(
    "control (nonexistent path):",
    JSON.stringify(
      await new Promise((resolve) => {
        const child = spawn(join(binDir, "definitely-absent"), [], {
          shell: false,
        });
        child.on("error", (error) =>
          resolve({ code: error.code, errno: error.errno }),
        );
        child.on("close", (exitCode) => resolve({ exitCode }));
      }),
    ),
  );
}

// WIZ-11287: does tinyglobby output mismatch the projectDir that findEnvDir
// derives from it, so prepareRunDir's remapPath falls through?
async function probeSeparatorSplit() {
  section("WIZ-11287 separator split");
  const root = await mkdtemp(join(tmpdir(), "wiz11287-"));
  const flowsDir = join(root, "flows");
  await mkdir(flowsDir, { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "probe" }),
  );
  await writeFile(join(flowsDir, "a.flow.ts"), "export default {};\n");

  const matches = await glob(["**/*.flow.{ts,js}"], {
    cwd: root,
    absolute: true,
  });
  const file = matches[0];
  console.log("glob output:      ", JSON.stringify(file));
  console.log(
    "path.join output: ",
    JSON.stringify(join(flowsDir, "a.flow.ts")),
  );

  // findEnvDir walks up with dirname until it finds package.json.
  let projectDir = dirname(file);
  while (projectDir !== dirname(projectDir)) {
    const { existsSync } = await import("node:fs");
    if (existsSync(join(projectDir, "package.json"))) break;
    projectDir = dirname(projectDir);
  }
  console.log("derived projectDir:", JSON.stringify(projectDir));

  // remapPath's guard in src/domains/runtimeEnv/prepareRunDir.ts.
  const remapMatches = file === projectDir || file.startsWith(projectDir + sep);
  console.log("sep:", JSON.stringify(sep));
  console.log("remapPath guard matches:", remapMatches);
  console.log(
    remapMatches
      ? "=> staging remap fires; no bug"
      : "=> remapPath falls through and returns the SOURCE path; staging bypassed",
  );
}

await probeExtensionlessShim();
await probeSeparatorSplit();
