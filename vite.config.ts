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
  plugins: lazyPlugins(() => [
    cloudflare({ viteEnvironment: { name: "ssr" } }),

    tanstackStart(),
    viteReact(),
  ]),
});

export default config;
