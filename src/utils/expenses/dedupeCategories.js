// Removes repeated categories (same id) from a room's category list, keeping the first one. Heals rooms where a category was added twice.
export function dedupeCategories(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    if (!c || c.id == null || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out.length === list.length ? list : out;
}
