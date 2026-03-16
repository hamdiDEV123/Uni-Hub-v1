import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react_vendor: ["react", "react-dom", "react-router-dom"],
          query_vendor: ["@tanstack/react-query"],
          supabase_vendor: ["@supabase/supabase-js"],
          ui_vendor: ["framer-motion", "lucide-react", "sonner"],
        },
      },
    },
  },
}));
