// Deletes downloaded Poly Haven assets that no source file refers to, then rewrites the manifest.
//   node scripts/prune-assets.mjs        (run `npm run assets-doc` afterwards)
import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

async function sources(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await sources(p)));
    else if (p.endsWith(".js")) out.push(await readFile(p, "utf8"));
  }
  return out;
}
const code = (await sources("src")).join("\n");
const used = {
  models: new Set([...code.matchAll(/assets\.model\("([^"]+)"\)/g)].map((m) => m[1])),
  textures: new Set([...code.matchAll(/pbr\("([^"]+)"/g)].map((m) => m[1])),
  hdris: new Set([...code.matchAll(/assets\.sky\("([^"]+)"\)/g)].map((m) => m[1])),
};
const manifestPath = "public/assets/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const keep = [];
for (const m of manifest) {
  if (used[m.type]?.has(m.id)) keep.push(m);
  else {
    await rm(path.join("public/assets", m.folder), { recursive: true, force: true });
    console.log(`removed ${m.type}/${m.id}`);
  }
}
await writeFile(manifestPath, JSON.stringify(keep, null, 2) + "\n");
console.log(`kept ${keep.length} of ${manifest.length}`);
