export const testIssuer = "https://signin.example";
export const testResource = "https://app.example/api";
export const testBinding = { issuer: testIssuer, resource: testResource };

export function makeJwt(payload: unknown): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [encode({ alg: "RS256" }), encode(payload), "sig"].join(".");
}
