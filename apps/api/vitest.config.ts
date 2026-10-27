import { config } from "dotenv";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

config({ path: "../../.env" });
// swc emits decorator metadata, which Nest DI needs (esbuild does not)
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { fileParallelism: false, env: { UPLOAD_DIR: join(tmpdir(), "ecom-test-uploads"), NODE_ENV: "test", CATALOG_CACHE_MS: "0", STOCK_ALERT_LIMIT_PER_HOUR: "1000" } },
});
