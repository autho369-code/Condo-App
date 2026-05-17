import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    root: path.resolve(import.meta.dirname),
    include: ["server/**/*.test.ts"],
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});
