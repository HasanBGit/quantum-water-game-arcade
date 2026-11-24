import { defineConfig } from "vite";

// Pages: the game (index.html), the maths check page (maths.html) and the team page (team.html).
export default defineConfig({
  base: "./", // relative, so it works under a GitHub Pages project path
  cacheDir: ".vite-cache", // own cache, so this copy never touches the other copy's node_modules/.vite
  build: {
    rollupOptions: {
      input: { main: "index.html", maths: "maths.html", team: "team.html" },
    },
  },
});
