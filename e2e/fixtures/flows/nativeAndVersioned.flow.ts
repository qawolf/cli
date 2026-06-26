import { flow } from "@qawolf/flows/web";
import sharp from "sharp";
import { FILE_HEADERS_ONLY } from "diff";

export default flow(
  "Native + Versioned Deps",
  { target: "Web - Chrome", launch: {} },
  async ({ page, test }) => {
    await test("project deps + native module resolve", async () => {
      // diff@^8.0.3 only: FILE_HEADERS_ONLY does not exist in the executor's diff@8.0.2.
      if (FILE_HEADERS_ONLY === undefined) {
        throw new Error("diff FILE_HEADERS_ONLY missing — wrong diff version resolved");
      }
      // sharp's native addon must actually load and run.
      const png = await sharp({
        create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
      })
        .png()
        .toBuffer();
      if (png.length === 0) throw new Error("sharp produced no output");
      await page.goto("https://example.com");
    });
  },
);
