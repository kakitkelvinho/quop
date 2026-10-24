// Every note's text, keyed by slug. Imported (not read with fs) so each note
// is in the module graph and `next dev` reacts to edits. The `*.md` rule in
// next.config.mjs makes each import a string.
//
// Note: `{ eager: true, import: "default" }` returned undefined values in
// Next 16.4.2, so take `.default` by hand.
const modules = import.meta.glob<{ default: string }>("/notes/*.md", { eager: true });

export const notes: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([key, mod]) => [
    key.replace(/^\/notes\//, "").replace(/\.md$/, ""),
    mod.default,
  ]),
);
