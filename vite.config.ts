import { defineConfig, lazyPlugins } from "vite-plus";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
  server: { port: 6767 },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    },
    options: { typeAware: true, typeCheck: true },
  },
  resolve: { tsconfigPaths: true },
  // The Cloudflare plugin's "ssr" worker environment rejects the
  // `resolve.external` Vitest 4 sets on every environment at startup
  // (https://github.com/cloudflare/workers-sdk/issues/10120-adjacent bug,
  // still open upstream). Our vitest suite only exercises pure functions
  // (see AGENTS.md Testing), so skip the plugin entirely under `vp test`
  // rather than pulling in `@cloudflare/vitest-pool-workers` for logic that
  // never touches the Workers runtime.
  plugins: lazyPlugins(() => [
    ...(process.env.VITEST ? [] : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    tanstackStart(),
    viteReact(),
  ]),
});

export default config;
