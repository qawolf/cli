export const environmentsMessages = {
  noEnvironments:
    'No environments found on your team. Create one with "qawolf environment create".',
  usingEnvironment: (name: string) => `Using environment ${name}`,
  usingFromEnvVar: (env: string) =>
    `Using environment from QAWOLF_ENVIRONMENT (${env})`,
  exportHint: (env: string) =>
    `Tip: export QAWOLF_ENVIRONMENT=${env} to make this your default environment.`,
  whichEnvironment: "Which environment?",
  whichKind: "Which kind of environment?",
  kindLabels: {
    static: "Static environments",
    preview: "Preview (PR) environments",
  },
  aborted: "Aborted; no environment selected.",
  tooManyPages: (pages: number) =>
    `Stopped listing environments after ${pages} pages. Pass --env explicitly.`,
};
