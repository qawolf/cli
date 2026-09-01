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
  resolvedAlias: (ref: string, id: string) =>
    `Environment ${ref} resolved to ${id}.`,
  couldNotResolve: (ref: string, detail: string) =>
    `Could not resolve environment ${ref}: ${detail} If ${ref} is an alias, note that aliases require a team API key.`,
  aborted: "Aborted; no environment selected.",
  usingPulledEnv: (env: string) =>
    `Could not reach the platform to resolve environment ${env}; using the copy pulled into .qawolf/${env}.`,
  tooManyPages: (pages: number) =>
    `Stopped listing environments after ${pages} pages. Pass --env explicitly.`,
};
