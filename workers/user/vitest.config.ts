// @ts-check
// vitest.config.js
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { esbuildDecorators } from "esbuild-decorators";

export default defineWorkersConfig({
  optimizeDeps: {
    esbuildOptions: {
      plugins: [esbuildDecorators()],
    },
  },
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
