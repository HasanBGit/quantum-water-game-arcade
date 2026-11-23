// "Words" panel: plain-language meanings for the terms in the game. One tap-open list; open(id) jumps to a term.
export function createGlossary({ text, button }) {
  const G = text.glossary;
  const panel = document.createElement("section");
  panel.id = "glossary";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", G.title);

  const head = document.createElement("div");
  head.className = "gl-head";
  const title = document.createElement("h2");
  title.textContent = G.title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "gl-close";
  close.textContent = G.close;
  head.append(title, close);

  const intro = document.createElement("p");
  intro.className = "gl-intro";
  intro.textContent = G.intro;

  const list = document.createElement("div");
  list.className = "gl-list";
  const items = new Map();
  for (const t of G.terms) {
    const d = document.createElement("details");
    d.dataset.term = t.id;
    const sum = document.createElement("summary");
    sum.textContent = t.term;
    const mean = document.createElement("p");
    mean.textContent = t.mean;
    const like = document.createElement("p");
    like.className = "gl-like";
    const lab = document.createElement("strong");
    lab.textContent = `${G.likeLabel} `;
    like.append(lab, t.like);
    d.append(sum, mean, like);
    // Open one at a time, so the list stays short.
    d.addEventListener("toggle", () => {
      if (d.open) items.forEach((o) => o !== d && (o.open = false));
    });
    items.set(t.id, d);
    list.append(d);
  }
  panel.append(head, intro, list);
  document.body.append(panel);

  button.textContent = `? ${G.button}`;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "glossary");

  function open(id) {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const d = items.get(id);
    if (d) {
      d.open = true;
      d.scrollIntoView({ block: "nearest" });
    }
  }
  function shut() {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.focus();
  }
  button.addEventListener("click", () => (panel.hidden ? open() : shut()));
  close.addEventListener("click", shut);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) shut();
  });
  return { open, close: shut };
}
