---
name: add-calculator
description: Add a new calculator to QUOP's Calculators section, or extend one, following the house pattern (linked fields, formula sheet with a Symbols fold, nav entry, pictogram, tests, screenshot check). Use whenever the user asks for a new calculator, converter or quick estimate tool, or for a new input, output or plot on an existing one.
user-invocable: true
argument-hint: "[what the calculator converts or estimates]"
---

# Adding a calculator

A QUOP calculator is a sheet of working: fields typed in, answers worked out as you type, the equations under it, and a fold naming every symbol. Every calculator has the same parts, in the same files. This guide is the order to build them in and the rules each part follows.

Read `DESIGN.md` (the Sign Rule, the Flat Sheet Rule, the Square Rule) before styling anything, and copy the nearest existing calculator rather than inventing a new pattern. The Energy-Wavelength, Light Travel and Gaussian Beam calculators are the references: two linked fields, unit pickers, and an Advanced fold with a plot, respectively.

## 1. Settle the physics before any code

Ask the user before building if any of these is unclear, and keep the questions short.

- **Write the equations down.** Name every symbol, its unit, and each constant's value and source. Constants are exact SI values where one exists (h, c, e).
- **Find the shared value.** Two linked fields both convert through one value, for example the photon energy in joules, a time in seconds or the waist radius in metres. Pick it, and check that each field maps to it one-to-one.
- **Check the physics closes.** Say plainly when the conversion the user asked for needs another input. For example, a Raman shift needs the excitation wavelength to become a wavelength. Propose where that input comes from (reuse a field already on the page if it can) and ask before building.
- **Decide what is primary and what is Advanced.** The fields most readers touch go on the sheet. Inputs that are almost always at a default (M² = 1, n = 1) go under an Advanced fold.
- **Agree the outputs.** Only outputs the user wants: one extra number is a line in the `readoutAside`, not a new field. Drop anything the user calls unnecessary.

## 2. The maths, pure and tested

- Put the conversions in `src/components/calculators/linked-pair.ts` as `Quantity` objects (`read: text → shared value | null`, `write: shared value → text`). A quantity that depends on another input is a function taking it (`rayleighRangeQuantity(unit, wavelength, mSquared, index)`).
- `read` returns `null` for anything that isn't a valid value (empty, zero where zero is meaningless, a missing extra input). The other field then shows a dash.
- Units: give a `Record<Unit, number>` table in SI (as `DISTANCE_UNITS`, `TIME_UNITS`) and use `unitLabel` for the µ.
- Write with `formatSignificant` (5 or 6 figures) and read with `readNumber`, so a written value like `3.18 × 10⁻⁵` can be edited in place.
- Add tests to `linked-pair.test.ts`: one hand-checked value in each direction (state the arithmetic in a comment), and the empty/invalid cases. Work the expected value out with code, not mentally; mental arithmetic has been wrong here before.

## 3. The component

`src/components/calculators/<name>-calculator.tsx`, a client component:

- `"use client"`, takes `{ children }: { children?: ReactNode }` and renders it last, inside the `pageSection`. That is where the server-rendered formula sheet goes.
- `<ToolIntro href="/calculators/<slug>" />` for the heading. Pass an `aside` only when the label is an abbreviation (LIDT).
- `<LinkedFields>` for a linked pair. Unit pickers go through `units` and `changeUnit`, as in `light-travel-calculator.tsx`.
- A single plain input is a `.field` with a `DecimalNote`, as the wavelength in `gaussian-beam-calculator.tsx` is.
- Extra outputs go in one `p.readoutAside` line: the label, the formula in `.readout__formula`, then the value. Unit choices there are a small `select.readoutAside__unit`.
- Advanced settings go in `<details className="advancedSettings">`. Its `summary` shows any value that isn't at its default (`Advanced · M² = 1.3`). Each field is labelled by its `<label htmlFor>` only, with its note linked by `aria-describedby`; never put the note inside the label.

## 4. Wiring

All four are needed, or the tool is missing from somewhere:

1. **Page**: `src/app/calculators/<slug>/page.tsx` exports `metadata = toolMetadata(href)` and renders `<Calculator><FormulaSheet href={href} /></Calculator>`.
2. **Navigation**: add a link to the Calculators section in `src/components/navigation.ts`. The label is short ("Gaussian Beam"; the page adds "Calculator"). The description is one line in the house form, `A ↔ B.`
3. **Pictogram**: add a 24 × 24 outline path in `src/components/tool-pictograms.tsx`, with a comment saying what it draws.
4. **Formula sheet**: add an entry to `FORMULA_SHEETS` in `src/components/calculators/formula-sheets.ts`:
   - `equations`: TeX, one per relation the calculator uses, and none it doesn't.
   - `symbols`: one row per symbol in the equations. `meaning` is a few words; `unit` is the unit the calculator uses (`\text{chosen above}` when a picker sets it); `value` is filled only for constants, built from the code's own constants (`texScientific(PLANCK)`), not retyped.
   - The test in `formula-sheets.test.ts` typesets every entry, so a TeX typo fails `npm test`.

## 5. Plots, if asked

Draw them as inline SVG in their own component, not with the Chart.js plotters. See `gaussian-beam-profile.tsx`:

- Colours come from the theme tokens (`--foreground`, `--muted`, `--border`, `--accent`, with a lighter blue at night), so both themes work.
- Keep the window fixed while the reader edits, so a change shows as the drawing moving. Give a "Fit" sign to reframe.
- Shade continuous fields with per-column gradients in `userSpaceOnUse`, on whole-unit columns with `shapeRendering="crispEdges"`, so no seams show.
- Clip curves to the plot area, and hide labels that would collide.
- The layout must not scroll sideways at 375 px.

## 6. Copy

- Labels are a few words. Notes are one short sentence. No paragraph explains the physics on the page; that is what the Symbols fold is for.
- Before finishing, list every visible string (labels, notes, legend, caption, symbol meanings) for the user and offer cuts. Anything they call unnecessary goes.

## 7. Verify, then ship

1. Run `npx tsc --noEmit -p .`, `npm run lint` (no new warnings), `npm test` and `npm run build`.
2. Serve the static export with `PORT=3123 BASE_PATH="" node scripts/serve-out.mjs` (`next start` doesn't work with `output: "export"`). Screenshot the page with Playwright in light and dark at desktop width, and at 375 px with every fold open. Check that `document.documentElement.scrollWidth` equals the viewport width.
3. Type a hand-checked value into the page and read the other field back, to confirm the wiring as well as the maths.
4. Commit with a message saying what the calculator does and the equations it uses.
