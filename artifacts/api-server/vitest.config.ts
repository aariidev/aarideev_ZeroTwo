import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // ESM nativo — igual que el resto del proyecto
    globals: false,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/bot/games/**", "src/bot/lib/**"],
      exclude: ["**/__tests__/**"],
    },
  },
});
