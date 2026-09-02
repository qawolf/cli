import { pluralize } from "~/core/pluralize.js";

const allowNoMatchHint = "Pass --allow-no-match to exit 0 instead.";

export const lintMessages = {
  noFilesMatched: "No lintable source files matched.",
  noFilesMatchedPattern: (pattern: string | undefined) =>
    pattern === undefined
      ? `No lintable source files found. ${allowNoMatchHint}`
      : `No lintable source files matched '${pattern}'. ${allowNoMatchHint}`,
  unreadableFiles: (count: number) =>
    `${pluralize(count, "file")} could not be read, so ${count === 1 ? "it was" : "they were"} not checked`,
};
