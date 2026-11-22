import { defineConfig } from "vite";

// Two pages: the game (index.html) and the maths check page (maths.html).
export default defineConfig({
  base: "./", // relative, so it works under a GitHub Pages project path
  cacheDir: ".vite-cache", // own cache, so this copy never touches the other copy's node_modules/.vite
  build: {
    rollupOptions: {
      input: { main: "index.html", maths: "maths.html" },
    },
  },
});
