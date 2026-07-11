import { defineConfig } from "tsup";

const sharedConfig = {
  entry: ["src/index.js", "src/browser.js", "src/xr.js"],
  target: "es2022",
  sourcemap: true,
};

export default defineConfig([
  {
    ...sharedConfig,
    format: ["esm"],
    clean: true,
    dts: false,
  },
  {
    ...sharedConfig,
    format: ["cjs"],
    clean: false,
    dts: false,
  },
]);
