// Phone Simulate screen: the caption box changes height with its text, but the view tabs and the number chips sit
// under it at fixed offsets, so they used to cover the end of the text. This keeps them just below its real bottom edge.
// Only runs on narrow screens during Simulate. Desktop layout is plain CSS.
const root = document.documentElement;

function layout() {
  if (document.body.dataset.phase !== "simulate" || window.innerWidth > 700) return;
  const top = document.querySelector(".simtop");
  if (!top) return;
  const below = Math.round(top.getBoundingClientRect().bottom) + 8;
  const view = document.querySelector(".simview");
  const viewHeight = view && !view.hidden ? view.getBoundingClientRect().height : 0;
  root.style.setProperty("--sim-view-top", `${below}px`);
  root.style.setProperty("--sim-chips-top", `${below + viewHeight + 8}px`);
}

setInterval(layout, 200);
