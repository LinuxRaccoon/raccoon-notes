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
      // Precache the app shell (JS/CSS/HTML) so the app itself opens
      // offline. Notes/folders data is never precached here — that's
      // handled separately by the localStorage cache + sync queue in
      // src/lib, which is what makes the phone usable with no signal.
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallbackDenylist: [/^\/\.netlify\/functions\//],
      },
    }),
  ],
});
