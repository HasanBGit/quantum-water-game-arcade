// Checks a snapshot of the game, so edits from other sessions cannot disturb the run.
//   npm run verify:snapshot
// Builds the project into .verify-dist, serves that copy on its own port, runs the browser checks
// against it (opening the game with ?skip to pass the intro), then cleans up.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import net from "node:net";

// A free port and a private output folder for every run, so two sessions never collide.
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
const PORT = String(process.env.SNAPSHOT_PORT ?? (await freePort()));
const OUT = `.verify-dist-${process.pid}`;

const build = spawnSync("npx", ["--no-install", "vite", "build", "--outDir", OUT, "--emptyOutDir"], { stdio: "inherit" });
if (build.status !== 0) {
  console.error("The build failed, so there is nothing to check. Someone may be mid-edit; try again.");
  process.exit(build.status ?? 1);
}

const preview = spawn("npx", ["--no-install", "vite", "preview", "--outDir", OUT, "--port", PORT, "--strictPort"], { stdio: "ignore" });
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try {
    up = (await fetch(`http://localhost:${PORT}/`)).ok;
  } catch {}
  if (!up) await new Promise((r) => setTimeout(r, 500));
}
if (!up) {
  preview.kill();
  console.error(`The preview server did not start on port ${PORT}.`);
  process.exit(1);
}

// Chrome sometimes dies on a busy machine. If the check itself crashed (exit code 2), try once more.
let run;
for (let attempt = 1; attempt <= 2; attempt++) {
  run = spawnSync("node", ["scripts/verify-game.mjs"], {
    stdio: "inherit",
    env: { ...process.env, GAME_URL: `http://localhost:${PORT}/?skip` },
  });
  if (run.status !== 2) break;
  console.error(`The check crashed (attempt ${attempt}). ${attempt === 1 ? "Trying once more." : "Giving up."}`);
}
preview.kill();
rmSync(OUT, { recursive: true, force: true });
process.exit(run.status ?? 1);
