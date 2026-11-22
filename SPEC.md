# Quantum Water: game spec (Stage 0, v1 for review)

Structure follows the Tripo game prompts (scope, references, loop and states, assets, visual direction, technical notes, acceptance). Nothing in this file is built yet.

## 1. Project and scope
A 3D browser game about one question: when should a desalination plant run its pumps to pay the least for electricity? The visitor runs the plant for one day, then presses **Simulate** to see how a search finds the cheapest plan, first the classical way, then the Grover way. Everything quantum is simulated on a laptop. The game does not claim any quantum advantage.

Need (assumption, not yet tested with students): a first-year university student who has never seen a qubit needs to feel why picking the cheapest hours is not always the cheapest plan, in order to understand what the quantum search is looking for. Job: finish the game in about three minutes and be able to say what the problem is, why it gets hard, and what the search does.
Success: functional, they can state the four answers below; emotional, they feel they found something out, not that they were lectured.

The four answers the game must give, in order (from notebook section 5):
1. The problem: choose which 3 of 5 time slots the train runs, at the lowest bill.
2. Why it gets hard: 5 slots give 32 plans; 24 hours for 10 trains give 2^240.
3. What the quantum search does: mark every plan cheaper than your best, amplify the marked ones, measure, repeat with a lower bar.
4. How real it is today: simulated, 12 qubits, and a loop over 32 plans is faster.

## 2. References
- Notebook `09_use_desalination_grover.ipynb`: problem, equations (1)-(8), toy numbers, honesty text (section 4), audience and four questions (section 5).
- Team document: cost function and tariff c = [2, 4, 7, 6, 3], S = 5, P = 10; optimum {1,2,3} = 18, greedy {1,2,5} = 19 (recomputed and checked).
- Desalination (Wikipedia, read in part): reverse osmosis uses 3-5.5 kWh per cubic metre; seawater average about 3 kWh per cubic metre (2018); Ras Al-Khair makes 1,401,000 cubic metres per day. These are the only real-plant figures allowed on screen.
- Research notes are in the plan file `okay-i-see-that-crispy-popcorn.md`.

## 3. Core loop and states
Title, Play, Simulate, Result, then Retry (new tariff or same one).

**Play.** Five bays in a row, one per time slot ("same train, five times of day"). Each bay has a pump terminal and a price board. The operator walks to a terminal and presses it to switch that slot on or off. Rule: exactly 3 slots. A bill slip shows the live sum:
`electricity + restarts x 5 + rule penalty = total`, with the numbers filled in.
A restart is a slot that is on after an off slot; its pump shudders once.

**Simulate.** The plant folds into a table of 32 tanks, one per plan. Your plan is highlighted in the same colour in every later screen. The bar is your plan's cost. Steps: the oracle drops the tanks cheaper than the bar below the ground line; reflect mirrors every level about the average; success chance appears under a step control. Beside it, a classical clerk checks plans one by one and a counter runs to 32.

**Result.** Three cards: your plan, the cheapest plan, the greedy plan (three cheapest slots). Then the honest banner (notebook wording), then Zoom Out: 32, 16,777,216, 2^240; even the square-root step count 2^120 is out of reach.

Five states per screen (loading, empty, error, partial, success):

| Screen | Loading | Empty | Error | Partial | Success |
|---|---|---|---|---|---|
| Play | Plant loading, with a progress bar after 10 s | No slots chosen: bill shows the rule penalty of 90 and the line "Choose 3 slots" | WebGL not available: text and table version of the same game | 1-2 or 4-5 slots chosen: penalty line visible; Simulate disabled with the reason beside it | 3 slots chosen: Simulate enabled |
| Simulate | Tanks filling in | Your plan is already the cheapest: "No plan is cheaper than yours. The search stops." (marked count is 0) | Same fallback as Play | Marked count 1 or more: normal | Probability reaches the peak step; the next step is shown to fall |
| Result | none | none | none | none | Cards and banner |

## 4. Scene and asset plan
Real models where a good one with a clear licence exists (each recorded with its source and licence in `ASSETS.md`); simple shapes only for what is missing. Every asset has a stable id so it can be swapped.

| id | What it is | Notes |
|---|---|---|
| `operator` | Person with a white hard hat and a teal vest | One signature feature (the hat); readable as a silhouette at phone size |
| `terminal` | Control post with a lamp and a button, one per slot | The five pump terminals |
| `pump_skid` | High-pressure pump on a steel frame | Stands in each bay; shakes on a restart |
| `membrane_rack` | Rack of horizontal vessels | Lights up when its slot is on |
| `tank` | Product-water tank | Also the unit of the 32-tank view |
| `pipe` | Straight, elbow and tee pieces | From intake to tanks to outfall |
| `intake_head`, `brine_diffuser` | Sea ends of the water path | Scenery |
| `tree`, `wall`, `fence` | Site dressing | Trees from ez-tree (MIT); walls and fences from boxes |
| `sea_tile` | Low-poly water plane | About 48 x 48 segments |

Water path order for the scenery: intake head, screen-house pump, dosing tanks, filter vessels, high-pressure pump (the terminals), membrane racks, product tanks, brine outfall.

## 5. Visual direction (proposal)
Colours carry meaning, not decoration.
- Water and probability: teal `#2B9DB8`.
- Electricity price: safety yellow `#F1B80A`.
- Restart cost and rule penalty: signal red `#D6452B`.
- Sea deep `#0A3F4F`; concrete `#BFC5C0`; steel `#5E7480`; ink `#12242B`; panel `#F3F5F4` (cool, not cream).

Type: one family with Latin and Arabic, Readex Pro (to confirm it loads), tabular figures for every number. The bill slip is the main interface: it reads like a utility bill with line items. The 32-tank view is the one memorable moment; everything else stays quiet.
Checked against the common defaults: no cream and terracotta, no near-black with an acid accent, no uppercase eyebrows, no numbered markers except for real steps, one corner radius.
Look: as real as possible. Physically based materials, sun plus a sky light, believable water with foam, shadows on desktop. Quality tiers (resolution, shadows, water detail) keep it running on phones. Replaces the earlier toon and outline idea.
Motion: cold-start shake 0.1-0.3 s eased out; bill numbers count up in 0.3-0.5 s (suggestion); a "reduce motion" switch removes shake and walking speed-up.

## 6. Technical notes
Vite and three.js, node 25. Separate folders for maths, scene, input, state and UI. The maths module is plain code with no 3D, tested on its own. Every string in one table. One input path for mouse, touch and keyboard; each terminal also has a normal button so the game works without the 3D click. The Grover curve and tank levels run live in JavaScript (a port of the notebook's `grover_by_hand`); the Qiskit circuit picture is exported from the notebook and labelled as exported.

## 7. Acceptance
- The numbers match: 18, 19, 99.9 percent after 4 steps, and 86.0 percent after 5.
- Every one of the 32 plans gives the same bill in Play as in the maths table.
- A player can go from Title to Result and Retry on a phone and on a laptop, using only the keyboard if they want.
- Simulate handles marked counts of 0, 1 and more.
- The result screen says what the toy does not show.
- Anything not checked is listed at the gate.

## 8. Decisions (settled)
1. **Realism:** as real as possible. The operator is a realistic person with a white hard hat.
2. **Assets:** download good-quality models from outside. Each one is kept only if its licence allows our use, and is recorded in `ASSETS.md`.
3. **Language:** English first. Arabic and right-to-left come later (Stage 7).
4. **Terminals** (not changed by the answer, so the default stands): the five pump terminals are five bays, one per time slot, laid out like a timeline. A real plant has one train; the bays show five times of day.
