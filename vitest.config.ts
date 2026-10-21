import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx", "tests/**/*.test.ts"],
  },
});
