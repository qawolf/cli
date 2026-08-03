export const updateCheckMessages = {
  title: "Update available",
  body: (current: string, latest: string): string =>
    `@qawolf/cli ${current} → ${latest}\nRun \`npm install -g @qawolf/cli\` to update.`,
};
