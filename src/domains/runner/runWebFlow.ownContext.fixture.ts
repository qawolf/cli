import { flow, isAnonymous, launch } from "@qawolf/flows/web";

// Mirrors helpers that discard launch()'s context and create their own via
// browser.newContext (the pattern that bypassed artifact recording).
export default flow("ownContext", "Web - Chrome", async () => {
  const result = await launch();
  if (!isAnonymous(result)) throw new Error("expected anonymous launch");
  await result.browser.newContext({});
});
