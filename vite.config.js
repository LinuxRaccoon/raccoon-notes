import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["raccoon-icon.png"],
      manifest: {
        name: "Raccoon Notes",
        short_name: "Raccoon Notes",
        description: "Notes, tidied into dens.",
        theme_color: "#C97A2B",
        background_color: "#F7F4EE",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // Only precache the app shell (JS/CSS/HTML) — never the notes API.
      // Notes always come from a live network request, matching the
      // no-offline-editing decision made earlier.
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallbackDenylist: [/^\/\.netlify\/functions\//],
      },
    }),
  ],
});
