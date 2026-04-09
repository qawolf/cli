import { writeJsonLine } from "./write.js";

export { writeJsonLine } from "./write.js";

export function createJson(): (data: unknown) => void {
  return writeJsonLine;
}
