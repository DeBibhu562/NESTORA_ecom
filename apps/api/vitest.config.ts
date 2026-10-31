import { config } from "dotenv";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

config({ path: "../../.env" });
// swc emits decorator metadata, which Nest DI needs (esbuild does not)
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { fileParallelism: false, env: { UPLOAD_DIR: join(tmpdir(), "ecom-test-uploads"), NODE_ENV: "test", CATALOG_CACHE_MS: "0", STOCK_ALERT_LIMIT_PER_HOUR: "1000", FIREBASE_PROJECT_ID: "test-proj", RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "key_secret_x", RAZORPAY_WEBHOOK_SECRET: "whsec_x", SHIPROCKET_EMAIL: "ops@example.com", SHIPROCKET_PASSWORD: "pw", SHIPROCKET_WEBHOOK_TOKEN: "srtok", ADMIN_EMAIL: "shop@example.com" } },
});
