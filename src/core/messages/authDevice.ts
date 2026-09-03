/** What browser sign-in says, from the code prompt to the ways it can fail. */
export const deviceMessages = {
  unavailable:
    "This QA Wolf deployment does not offer browser sign-in. Run 'qawolf auth login' again and choose 'API key'.",
  configUnreachable:
    "Could not ask this QA Wolf deployment whether it offers browser sign-in. Check your connection, then try again.",
  legacyOnly:
    "Browser sign-in is unavailable: this QA Wolf deployment does not offer WorkOS Connect sign-in yet. Run 'qawolf auth login' again and choose 'API key'.",
  misconfigured:
    "This QA Wolf deployment publishes an incomplete browser sign-in configuration. Ask whoever runs it to check its WorkOS Connect settings.",
  discoveryFailed:
    "The sign-in provider this QA Wolf deployment names did not answer as one. Ask whoever runs the deployment to check its WorkOS Connect settings.",
  confirmCode: (userCode: string) => `Your code is ${userCode}`,
  visitUrl: (url: string) => `Confirm it at ${url}`,
  // RFC 8628 asks a client using the prefilled URL to show the plain one too,
  // for anyone who cannot follow the shortcut — a wrapped or truncated long
  // URL in a narrow terminal being exactly that case.
  visitUrlPlain: (url: string) => `Or go to ${url} and enter the code`,
  openFailed: (url: string) =>
    `Could not open a browser automatically. Open ${url} yourself to continue.`,
  waiting: "Waiting for you to finish in the browser",
  signedIn: (email: string) => `Signed in as ${email}.`,
  failed: {
    "access-denied": "The sign-in request was rejected.",
    expired: "The sign-in request expired. Run 'qawolf auth login' to retry.",
    timeout: "The sign-in request timed out. Run 'qawolf auth login' to retry.",
    network: "Could not reach WorkOS to complete sign-in.",
    unavailable: "Could not start browser sign-in.",
    cancelled: "Sign-in cancelled.",
    "refresh-failed":
      "Sign-in was approved, but WorkOS did not issue a token for this QA Wolf deployment.",
    "token-rejected":
      "Sign-in was approved, but WorkOS issued a token this QA Wolf deployment would not accept. Ask whoever runs the deployment to check that its API URL is registered with WorkOS.",
    "identity-rejected":
      "Sign-in was approved, but the QA Wolf API did not accept the new session.",
  },
} as const;
