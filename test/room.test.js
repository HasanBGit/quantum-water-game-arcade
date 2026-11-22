import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, validVote } from "../server/tally.mjs";
import { createRoom } from "../server/room.mjs";

const vote = (x) => ({ x });

test("votes are accepted only in the right shape", () => {
  assert.ok(validVote({ voter: "a", slots: [1, 1, 1, 0, 0] }));
  assert.equal(validVote({ voter: "", slots: [1, 1, 1, 0, 0] }), null);
  assert.equal(validVote({ voter: "a", slots: [1, 1, 1, 0] }), null);
  assert.equal(validVote({ voter: "a", slots: [1, 1, 1, 0, 2] }), null);
  assert.equal(validVote({ voter: "a", slots: "11100" }), null);
  assert.equal(validVote(null), null);
  assert.equal(validVote({ voter: "x".repeat(200), slots: [0, 0, 0, 0, 0] }).voter.length, 64);
});

test("the tally counts bills, the best plan and the obvious plan from the maths", () => {
  const votes = new Map([
    ["a", vote([1, 1, 1, 0, 0])], // the cheapest, 18
    ["b", vote([1, 1, 1, 0, 0])],
    ["c", vote([1, 1, 0, 0, 1])], // the 3 cheapest slots, 19
    ["d", vote([1, 0, 1, 0, 1])], // 27
    ["e", vote([1, 0, 0, 0, 0])], // not 3 slots: not counted as a plan
  ]);
  const s = summarize(votes);
  assert.equal(s.voters, 5);
  assert.equal(s.legal, 4);
  assert.equal(s.foundBest, 2);
  assert.equal(s.pickedObvious, 1);
  assert.equal(s.best.bill, 18);
  assert.equal(s.obvious.bill, 19);
  const bill = (n) => s.bills.find((b) => b.bill === n).count;
  assert.equal(bill(18), 2);
  assert.equal(bill(19), 1);
  assert.equal(bill(27), 1);
  assert.deepEqual(s.bills.map((b) => b.bill), [18, 19, 21, 22, 23, 24, 25, 27]); // every distinct bill is listed (10 plans, two pairs share a bill), even with zero votes
});

test("the server takes votes, refuses bad ones, and reports results", async () => {
  const server = createRoom();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    assert.equal((await post("/api/vote", { voter: "p1", slots: [1, 1, 1, 0, 0] })).status, 200);
    assert.equal((await post("/api/vote", { voter: "p1", slots: [1, 1, 0, 0, 1] })).status, 200); // changing your mind replaces the vote
    assert.equal((await post("/api/vote", { voter: "p2", slots: [9, 9, 9, 9, 9] })).status, 400);
    const r = await (await fetch(base + "/api/results")).json();
    assert.equal(r.voters, 1);
    assert.equal(r.pickedObvious, 1);
    assert.equal(r.foundBest, 0);
    assert.equal((await fetch(base + "/math/index.js")).status, 200);
    assert.equal((await fetch(base + "/math/../package.json")).status, 404); // only the maths files are served
    assert.equal((await fetch(base + "/play")).status, 200);
    assert.equal((await fetch(base + "/screen")).status, 200);
    assert.equal((await post("/api/reset", {})).status, 200);
    assert.equal((await (await fetch(base + "/api/results")).json()).voters, 0);
  } finally {
    server.close();
  }
});
