# Quantum Water

A 3D browser game about one question: when should a desalination plant run its pumps to pay the least for electricity?
You run the plant for a day (exactly 3 of 5 time slots, lowest bill), talk to the helpers, press Simulate to watch a search look for a cheaper plan, then see the result.

Everything quantum is **simulated on a laptop**. The game does not claim a quantum advantage, and says so.

## Run it
```
npm install
npm run dev          # the game, usually http://localhost:5173/
```
Add `?skip` to the address to skip the intro, `?lang=ar` for Arabic.

Controls: arrow keys or W A S D to walk. E (or Space, or a tap on the button) at a control post switches its slot. E near a helper starts a conversation (arrows and Enter or a number to reply, Esc to leave). O for the overview, M for sound. You can also click or tap a control post or a helper and the operator walks there.

## What is in it
| Part | Where |
|---|---|
| The maths (cost, 32 plans, Grover steps, one search round) | `src/math/` |
| The plant, equipment, pipes, signs | `src/game/world.js`, `builders.js`, `site.js` |
| Bill panel, control posts, pump shake | `bill.js`, `billpanel.js`, `terminals.js`, `pumps.js` |
| Helpers and conversations | `npcs.js`, `dialogue.js`, `scripts.js`, text in `src/strings.js` |
| Quest log | `quest.js` |
| Guided flow: intro, coach, Simulate, Result | `flow.js`, `tankField.js` |
| Quality tiers (high, medium, low), chosen from the device and measured frame time | `quality.js` |
| Arabic and right-to-left | `src/strings.ar.js`, `src/i18n.js` |
| Audience mode for a talk | `server/`, `room/` |
| Sound (sea, wind, machinery, birds), made in the browser | `audio.js` |

## Audience mode
```
npm run room
```
It prints a big-screen address and the address for phones (same Wi-Fi). People pick their own 3 slots on their phones; the big screen shows which bills the room got and how many found the cheapest plan. Votes are kept in memory, there are no accounts, and nothing leaves the local network.

## Checks
```
npm test                    # logic tests: maths, bill, conversations, tiers, Arabic text, audience tally
npm run verify:snapshot     # builds a copy and drives a real browser through the whole game
npm run assets-doc          # rewrites ASSETS.md from public/assets/manifest.json
```
`verify:snapshot` picks free ports each run, so it can run while someone else is editing or running their own checks. It writes screenshots to `verify-output/`.

## Assets and licences
`ASSETS.md` lists every downloaded model, texture and sky (all CC0, from Poly Haven) with source and licence. Trees come from EZ-Tree (MIT). Characters and equipment are built in code. The sound is made in the browser, so there is nothing to credit.

## Known limits (be honest about these when you show it)
- **Frame rate has only been measured in a test browser without a graphics card.** It has not been measured on a real phone. The quality tiers and budgets are starting numbers.
- **The Arabic text has not been read by a fluent speaker.** It follows the notebook's glossary, but it needs a review before it is shown. Panels keep their screen positions in Arabic; only the text direction flips.
- **The sound is synthesised**, so the birds sound artificial. Real recordings were not added.
- **The audience mode has only been tested with a script**, not with a room full of phones.
- The numbers (prices, restart cost 5, penalty 10) are invented for teaching. A real plant is scheduled with classical optimisation; nobody has shown a quantum advantage for it.

## Working with other sessions
Several sessions have worked on this project. `../COORDINATION.md` says who owns which files and the ground rules.
