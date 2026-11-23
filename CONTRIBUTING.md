# Contributing to Quantum Water

Thank you for helping. This is a teaching game about scheduling a desalination plant and a simulated Grover search, so clarity and honesty matter more than features.

## Ground rules
- **Be honest about the quantum part.** Everything quantum is simulated on a normal computer. Never claim a quantum advantage.
- **Every number on screen comes from `src/math/` or the notebook.** Do not type numbers into text by hand; the helpers' lines are filled from the maths.
- **Keep English and Arabic in step.** `src/strings.js` and `src/strings.ar.js` must have the same keys (`npm test` checks this). Arabic changes are best reviewed by a fluent reader; say in your pull request who read it.
- **Terms.** Quantum terms follow the glossary in the notebook. A term you coined is marked "proposed".

## Set up
```
npm install
npm run dev        # http://localhost:5173/ (add ?skip to jump past the intro)
npm test           # must pass before and after your change
npm run verify:snapshot   # optional: builds a copy and drives a real browser through the game
```

## Pull requests
1. Open an issue first for anything bigger than a small fix.
2. Keep changes small and focused. Match the existing style.
3. Run `npm test`. If you changed what the game shows, say what you checked on screen and what you did not.
4. Do not add assets unless their licence allows reuse. Record each one in `public/assets/manifest.json` and run `npm run assets-doc`.

## Reporting problems
Open an issue with the browser, the device, and what you pressed. Screenshots help. A wrong number or an unclear sentence is as welcome as a crash.

By contributing you agree that your work is released under the MIT licence (see `LICENSE`).
