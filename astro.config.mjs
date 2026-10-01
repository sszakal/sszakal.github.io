import react from "@astrojs/react";
import tailwind from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { FontaineTransform } from "fontaine";

// https://astro.build/config
export default defineConfig({
  site: "https://www.x86.cc",
  base: "/",

  vite: {
    plugins: [
      tailwind(),
      FontaineTransform.vite({
        fallbacks: ["Arial"],
        resolvePath: (id) => new URL(`./public${id}`, import.meta.url),
      }),
    ],
  },

  integrations: [react()],
});
