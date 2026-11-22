// Downloads CC0 assets from Poly Haven into public/assets/polyhaven/<type>/<id>/
// and records source, author, licence and size in public/assets/manifest.json.
//
//   node scripts/fetch-polyhaven.mjs <models|textures|hdris> <resolution> <id> [<id> ...]
//
// Each asset goes into its own new folder. Existing folders are left alone.
// Every file is checked against the md5 that Poly Haven publishes.
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

const API = "https://api.polyhaven.com";
const UA = "quantum-water-game-asset-fetch/1.0";
const [type, res, ...ids] = process.argv.slice(2);
if (!["models", "textures", "hdris"].includes(type) || !res || ids.length === 0) {
  console.error("usage: node scripts/fetch-polyhaven.mjs <models|textures|hdris> <resolution> <id> ...");
  process.exit(1);
}

const root = path.resolve("public/assets");
const manifestPath = path.join(root, "manifest.json");

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function download(entry, dest) {
  const r = await fetch(entry.url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${entry.url} -> ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const md5 = createHash("md5").update(buf).digest("hex");
  if (entry.md5 && md5 !== entry.md5) throw new Error(`checksum mismatch for ${dest}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

// Which files to take for each asset type.
function pick(files) {
  if (type === "models") {
    const g = files.gltf?.[res]?.gltf;
    if (!g) throw new Error(`no gltf at ${res}`);
    const list = [{ name: path.basename(g.url), entry: g }];
    for (const [rel, entry] of Object.entries(g.include ?? {})) list.push({ name: rel, entry });
    return list;
  }
  if (type === "textures") {
    const maps = [["Diffuse", "diff"], ["Rough", "rough"], ["nor_gl", "nor"], ["AO", "ao"], ["arm", "arm"]];
    const list = [];
    for (const [key, short] of maps) {
      const e = files[key]?.[res]?.jpg;
      if (e) list.push({ name: `${short}.jpg`, entry: e });
    }
    if (list.length === 0) throw new Error(`no jpg maps at ${res}`);
    return list;
  }
  const h = files.hdri?.[res]?.hdr;
  if (!h) throw new Error(`no hdr at ${res}`);
  return [{ name: `${path.basename(h.url)}`, entry: h }];
}

let manifest = [];
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {}

for (const id of ids) {
  const dir = path.join(root, "polyhaven", type, id);
  try {
    await access(dir);
    console.log(`skip ${id}: folder exists`);
    continue;
  } catch {}
  try {
    const [files, info] = await Promise.all([getJson(`${API}/files/${id}`), getJson(`${API}/info/${id}`)]);
    let bytes = 0;
    const names = [];
    for (const { name, entry } of pick(files)) {
      bytes += await download(entry, path.join(dir, name));
      names.push(name);
    }
    manifest = manifest.filter((m) => !(m.source === "polyhaven" && m.id === id && m.type === type));
    manifest.push({
      id,
      type,
      source: "polyhaven",
      name: info.name,
      url: `https://polyhaven.com/a/${id}`,
      licence: "CC0",
      authors: Object.keys(info.authors ?? {}),
      polycount: info.polycount ?? null,
      resolution: res,
      folder: `polyhaven/${type}/${id}`,
      main: names[0],
      bytes,
      fetched: new Date().toISOString().slice(0, 10),
    });
    console.log(`ok   ${id}: ${(bytes / 1048576).toFixed(2)} MB, ${names.length} files`);
  } catch (err) {
    console.log(`FAIL ${id}: ${err.message}`);
  }
}
await mkdir(root, { recursive: true });
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
