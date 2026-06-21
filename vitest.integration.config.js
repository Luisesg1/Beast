import { defineConfig } from "vitest/config";

// Tests de integración contra los emuladores de Firebase. Se ejecutan aparte de
// los unitarios: npm run test:integration (levanta los emuladores).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.js"],
    fileParallelism: false,
    env: {
      VITE_FIRESTORE_EMULATOR: "127.0.0.1:8080",
      VITE_FIREBASE_PROJECT_ID: "gymtracker-app-2c603",
      VITE_FIREBASE_API_KEY: "demo-key",
      VITE_FIREBASE_AUTH_DOMAIN: "localhost",
      VITE_FIREBASE_APP_ID: "demo-app",
    },
  },
});
