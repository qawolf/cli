import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { FlowTemplate, RepoShape, ShapeFile } from "./types.js";

// Absolute path to a flow template asset; read as text, never imported.
function flowTemplatePath(flow: FlowTemplate): string {
  return join(process.cwd(), "e2e", "fixtures", "flows", `${flow}.flow.ts`);
}

/**
 * Writes a shape's files plus its flow template into a tmp project dir. The flow
 * is just another file, written at join(runDir, flowArg) — the exact path passed
 * to `flows run`.
 */
export function materialize(shape: RepoShape, projectDir: string): void {
  const flowFile: ShapeFile = {
    path: join(shape.runDir, shape.flowArg),
    content: readFileSync(flowTemplatePath(shape.flow), "utf8"),
  };
  for (const file of [...shape.files, flowFile]) {
    writeProjectFile(projectDir, file);
  }
}

function writeProjectFile(projectDir: string, file: ShapeFile): void {
  const absPath = join(projectDir, file.path);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, file.content);
}
