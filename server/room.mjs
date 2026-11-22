// Audience mode for a talk: people on the same Wi-Fi open /play on their phones, pick their 3 slots
// and send them. The big screen opens /screen and shows what the room chose.
//   npm run room          then open the address it prints
// Everything is in memory, there are no accounts, and nothing leaves the local network.
import http from "node:http";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRESETS } from "../src/math/index.js";
import { summarize, validVote } from "./tally.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const MAX_VOTERS = 500;
const model = PRESETS.team;

export function lanAddresses(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) out.push(`http://${a.address}:${port}`);
  }
  return out;
}

export function createRoom() {
  const votes = new Map();

  const send = (res, status, type, body) => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(body);
  };
  const json = (res, status, obj) => send(res, status, "application/json; charset=utf-8", JSON.stringify(obj));
  const isLocal = (req) => ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);

  async function readBody(req) {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > 2048) throw new Error("too large");
      chunks.push(c);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://room");
      const p = url.pathname;
      if (req.method === "GET" && (p === "/" || p === "/screen")) return send(res, 200, "text/html; charset=utf-8", await readFile(path.join(root, "room/screen.html")));
      if (req.method === "GET" && p === "/play") return send(res, 200, "text/html; charset=utf-8", await readFile(path.join(root, "room/play.html")));
      // The pages use the game's own maths files, and only those.
      const m = p.match(/^\/math\/([a-z]+\.js)$/);
      if (req.method === "GET" && m) return send(res, 200, "text/javascript; charset=utf-8", await readFile(path.join(root, "src/math", m[1])));
      if (req.method === "GET" && p === "/api/info") {
        const port = req.socket.localPort;
        return json(res, 200, { urls: lanAddresses(port).map((u) => `${u}/play`), prices: model.prices, restart: model.restart, penalty: model.penalty });
      }
      if (req.method === "GET" && p === "/api/results") return json(res, 200, summarize(votes, model));
      if (req.method === "POST" && p === "/api/vote") {
        const vote = validVote(await readBody(req));
        if (!vote) return json(res, 400, { error: "send { voter, slots: five numbers, each 0 or 1 }" });
        if (!votes.has(vote.voter) && votes.size >= MAX_VOTERS) return json(res, 429, { error: "the room is full" });
        votes.set(vote.voter, { x: vote.x });
        return json(res, 200, { ok: true, voters: votes.size });
      }
      if (req.method === "POST" && p === "/api/reset") {
        if (!isLocal(req)) return json(res, 403, { error: "reset from the screen computer only" });
        votes.clear();
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "not found" });
    } catch (err) {
      return json(res, 400, { error: String(err.message ?? err) });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.ROOM_PORT ?? 8787);
  createRoom().listen(port, "0.0.0.0", () => {
    console.log(`Room mode is running.\n  Big screen:  http://localhost:${port}/screen`);
    const urls = lanAddresses(port);
    if (urls.length) console.log(`  Phones open: ${urls.map((u) => `${u}/play`).join("   ")}`);
    else console.log("  No Wi-Fi address found. Connect this computer to a network, then restart.");
  });
}
