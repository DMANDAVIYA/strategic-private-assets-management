import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "desktop",
    globals: true,
    environment: "node",
  },
});
