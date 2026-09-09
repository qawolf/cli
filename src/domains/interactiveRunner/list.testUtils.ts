type ListedRunner = {
  gpuAccelerated: boolean;
  id: string;
  runnerName: string;
  url: string;
};

export const watchUrl = (id: string) =>
  `https://app.qawolf.com/acme/runners/${id}`;

export function runner(id: string, runnerName = "playwright"): ListedRunner {
  return { gpuAccelerated: false, id, runnerName, url: watchUrl(id) };
}

export function listed(...runners: ListedRunner[]): {
  ok: true;
  value: unknown;
} {
  return { ok: true, value: { outcome: "success", runners } };
}

export const everywhere = { here: false };
export const onlyHere = { here: true };
