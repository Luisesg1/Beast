import { defineConfig } from "vitest/config";

// Config aislada para tests unitarios (no hereda el plugin React de vite.config).
// Los tests de reglas de Firestore corren aparte: npm run test:rules.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },
});
