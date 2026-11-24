import { defineConfig } from "vite";

// Pages: the game, the maths check page, the team page and one page per team member.
export default defineConfig({
  base: "./", // relative, so it works under a GitHub Pages project path
  cacheDir: ".vite-cache", // own cache, so this copy never touches the other copy's node_modules/.vite
  build: {
    rollupOptions: {
      input: { main: "index.html", maths: "maths.html", team: "team.html", "fay": "fay.html", "bushra": "bushra.html", "lina": "lina.html", "hassan-barmandah": "hassan-barmandah.html", "matt": "matt.html" },
    },
  },
});
