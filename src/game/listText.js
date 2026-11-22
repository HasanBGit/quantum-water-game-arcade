// Slot lists for the current language. English: "1, 2, 5" and "1, 2 and 5". Arabic: "1، 2، 5" and "1، 2 و5".
// `L` is the `list` block of the strings ({ sep, and, none }).
export const DEFAULT_LIST = { sep: ", ", and: " and ", none: "none" };

/** "1, 2, 5" (or the word for "none" when empty). */
export function joinSlots(items, L = DEFAULT_LIST) {
  return items.length ? items.join(L.sep) : L.none;
}

/** "1, 2 and 5". */
export function joinWithAnd(items, L = DEFAULT_LIST) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(L.sep)}${L.and}${items[items.length - 1]}`;
}
