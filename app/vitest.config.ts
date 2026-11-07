// Vitest config (D18): unit tests for business logic under src/lib and
// src/components/cart, run with `npm run test`. jsdom environment because
// lib/cart/store.ts and lib/api/orders.ts read/write window.localStorage.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    // jsdom omits `window.localStorage` entirely for the default `about:blank`
    // origin (security model: storage needs a real origin) — lib/cart/store.ts
    // and lib/api/orders.ts both need it for their localStorage round-trip tests.
    environmentOptions: {
      jsdom: { url: "http://localhost:3000" },
    },
    // Node 22+'s own experimental global `localStorage` (undefined unless
    // --localstorage-file is given) otherwise shadows jsdom's window.localStorage
    // inside Vitest's worker threads — this disables it there so jsdom's
    // implementation is the one actually used. The parent `vitest` process also
    // gets this flag directly (see package.json's "test" script), but worker
    // threads don't inherit CLI flags on their own; `execArgv` is required.
    poolOptions: {
      threads: {
        execArgv: ["--no-experimental-webstorage"],
      },
      forks: {
        execArgv: ["--no-experimental-webstorage"],
      },
    },
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
