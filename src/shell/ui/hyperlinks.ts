type TerminalEnv = Record<string, string | undefined>;

const osc8 = "\x1b]8;;";
const bel = "\x07";

const urlPattern = /https?:\/\/\S+/g;
const trailingPunctuation = /[.,;:!?)\]}'"]+$/;

export function linkifyUrls(text: string): string {
  return text.replace(urlPattern, (match) => {
    const url = match.replace(trailingPunctuation, "");
    const trailing = match.slice(url.length);
    return `${osc8}${url}${bel}${url}${osc8}${bel}${trailing}`;
  });
}

function isAtLeast(
  version: string | undefined,
  minimum: { major: number; minor: number },
): boolean {
  const [rawMajor, rawMinor] = (version ?? "").split(".");
  const major = Number(rawMajor);
  const minor = Number(rawMinor);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  return (
    major > minimum.major || (major === minimum.major && minor >= minimum.minor)
  );
}

function termProgramSupportsHyperlinks(
  name: string,
  version: string | undefined,
): boolean {
  switch (name) {
    case "iTerm.app":
      return isAtLeast(version, { major: 3, minor: 1 });
    case "vscode":
      return isAtLeast(version, { major: 1, minor: 72 });
    case "ghostty":
    case "Hyper":
    case "rio":
    case "Tabby":
    case "WarpTerminal":
    case "WezTerm":
      return true;
    default:
      return false;
  }
}

export function supportsHyperlinks({
  env,
  stdoutIsTTY,
}: {
  env: TerminalEnv;
  stdoutIsTTY: boolean;
}): boolean {
  const forced = env["FORCE_HYPERLINK"];
  if (forced !== undefined && forced !== "") return forced !== "0";
  if (!stdoutIsTTY) return false;
  if (env["TERM"] === "dumb") return false;
  if (env["WT_SESSION"] || env["KONSOLE_VERSION"]) return true;
  if (env["TERM"] === "xterm-kitty") return true;
  if (Number(env["VTE_VERSION"] ?? "") >= 5000) return true;
  return termProgramSupportsHyperlinks(
    env["TERM_PROGRAM"] ?? "",
    env["TERM_PROGRAM_VERSION"],
  );
}
