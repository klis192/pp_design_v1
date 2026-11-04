import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxy = {
  "/api": {
    target: process.env.WAREHOUSE_DEV_API_TARGET ?? "http://127.0.0.1:3001",
    ws: true,
  },
};

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy,
  },
  preview: { proxy },
});
