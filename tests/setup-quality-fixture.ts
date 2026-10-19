import { createRequire } from "node:module";
import type { SetupQuality } from "../src/server/setup-quality.js";
export const qualityFixture: (prompt: string) => SetupQuality = createRequire(
  import.meta.url,
)("./fixtures/setup-quality.cjs");
