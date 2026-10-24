# Notes pipeline: Markdown/MDX with static export and build-time MathJax

Research for #299 (parent map #298). The question: which ways of turning note files into pages work with Next 16 `output: "export"` and build-time MathJax, and what does each cost?

Versions checked: `next` 16.4.2 (Turbopack, the default bundler), `@next/mdx` 16.4.2, `@mdx-js/mdx` 3.1.1, `next-mdx-remote` 6.0.0, `remark-math` 6.0.0, `rehype-mathjax` 7.1.0 (on `mathjax-full` 3.2.1), `@mathjax/src` 4.1.3, `katex` 0.19.1, `rehype-katex` 7.0.1, `remark-directive` 4.0.0, `hast-util-to-jsx-runtime` 2.3.6.

**Verified** means I ran it in the throwaway app in `research/notes-pipeline/` on this branch (`npm i`, then `npx next build`, `npm run check`, `npm run probes`, and `node dev-probe.mjs` against `next dev -p 3456`). **Read** means it comes from docs or package source only.

## Recommendation

Use **plain Markdown through remark/rehype, run in a Server Component**, not MDX.

- **Loading notes.** Import each note's text with `import.meta.glob("/notes/*.md")` plus a Turbopack rule `"*.md": { type: "text" }`. That puts every note in the module graph, so `next dev` pushes edits to an open page.
- **Embeds.** Map a small set of directive names (`::chart{…}`) or code-fence languages (```` ```chart ````) to React components with `hast-util-to-jsx-runtime`.
- **Maths.** Use MathJax at build time with a short in-house rehype step on **MathJax 4** (`@mathjax/src`). It should render each note as one MathJax document, not formula by formula, because that is what makes forward `\eqref` work. `rehype-mathjax` is fine as a stopgap: it handles everything except forward references, and it sits on the deprecated `mathjax-full` 3.

Why not MDX: MDX turns ordinary prose into JSX and JavaScript. `<!-- … -->` and text like `<a, b>` stop the build, and `{1, 2}` in prose silently renders as `2`. For an author who types Markdown with raw LaTeX, that is a standing tax. What MDX offers in return (JS-valued props, `import` in a note) isn't needed. `next-mdx-remote` adds two more costs: it strips JS props by default, and its fs-read notes get no HMR.

Why not KaTeX: it has no `\label`/`\eqref` (verified, and absent from its source). A `\newcommand` doesn't carry over to later formulas unless you set `globalGroup`, and then it leaks across notes.

## Summary table

| | `@next/mdx` | `next-mdx-remote/rsc` | Plain Markdown (remark/rehype in RSC) |
|---|---|---|---|
| Builds under `output: "export"` | yes (verified) | yes (verified) | yes (verified) |
| MathJax `align`, macros, numbering, backward `\eqref` | yes (verified, `rehype-mathjax`) | yes (verified) | yes (verified) |
| Forward `\eqref` | `(???)` with `rehype-mathjax` (verified); fixable only with your own plugin | same | same, fixable in the in-house maths step (verified in isolation) |
| Prose with `<`, `{}`, `<!-- -->` | `<!--` and `<a,` fail the build; `{…}` evaluated as JS (verified) | same compiler, same traps | plain Markdown (verified) |
| `next dev` after an edit | HMR push in ~110 ms, reload ~150 ms (verified) | **no HMR push**: manual reload needed (verified) | HMR push in ~50 ms, reload ~150–230 ms (verified) |
| Embedding a component | `<Chart data={[1,2,3]} />`, global map in `mdx-components.tsx` (verified) | same syntax, but `data={…}` is **stripped** by default (`blockJS`) (verified) | `::chart{data="1,2,3"}` (string attributes) or a ```` ```chart ```` fence holding JSON (verified) |
| Plugin config constraints | Turbopack: plugin names and options must be serialisable (read) | none (runs at render time) | none (runs at render time) |
| Code we own | config only | config + page | ~60 lines (pipeline + embed mapping) + maths step |

## 1. Does it build under `output: "export"`?

All three build, and all three emit static HTML with the maths already rendered (verified: `out/md/demo/index.html`, `out/mdx/index.html`, `out/remote/index.html`, `out/katex/demo/index.html`).

- Server Components run during `next build` for a static export (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md:53-57`). Dynamic routes need `generateStaticParams()` and must not use `dynamicParams: true` (`static-exports.md:278-285`). The `/md/[slug]` pages use both.
- No maths or Markdown library reaches the client: no chunk in `out/_next/static/chunks/` mentions `mathjax`, `renderToString` or `micromark` (verified). Total client JS for the app was 608 KB, the same Next/React baseline as any page.
- **Gotcha (verified):** with Turbopack, bundling `mathjax-full` 3 into the server build fails at "Collecting page data" with `Cannot find module '.next/server/package.json'`. The cause is `mathjax-full/js/components/version.js:4-9`, which reads its version with `eval('require')` and `__dirname`. The fix is `serverExternalPackages: ["mathjax-full"]`. This hits every option that runs `rehype-mathjax` in a Server Component, which is all of them except `@next/mdx`, where the plugin runs inside the loader.
- `@next/mdx` with Turbopack: remark/rehype plugins must be given **by name, with serialisable options**, because functions can't be passed to Rust (`node_modules/next/dist/docs/01-app/02-guides/mdx.md:726-760`). Names are resolved with `require.resolve(name, { paths: [projectRoot] })` (`node_modules/@next/mdx/mdx-js-loader.js:9`), so a local plugin file path should also work (read, not tried).
- `next-mdx-remote` asks for `transpilePackages: ['next-mdx-remote']` under Turbopack (`next-mdx-remote/README.md:21-26`). I set it and didn't test without it.

## 2. Maths: MathJax (SVG/CHTML) vs KaTeX

Test note: `research/notes-pipeline/notes/demo.md`. It has config macros (`\ket`, `\R`), a `\newcommand{\half}` in one block reused in later blocks, `equation` + `\label`, an `align` with `\label`/`\nonumber`, a backward `\eqref` and a forward `\eqref`. `check.mjs` decodes MathJax's SVG glyphs (`data-c`) back to text.

### MathJax via `rehype-mathjax` (SVG): verified

Every pipeline gave the same output:

```
[1] 𝐸=12𝑚𝑣2(1)          ids=mjx-eqn:eq:energy      equation numbered, label anchored
[2] (1)                links=mjx-eqn:eq:energy    backward \eqref: correct, and a link
[3] (???)                                         forward \eqref: unresolved
[4] 𝑎=𝑏+𝑐𝑑=12𝑒𝑓=𝑔(2)(3)  ids=…eq:a,…eq:later      align: rows numbered, \nonumber respected
[5] 12                                            \half from an earlier block still defined
```

- **`align`, `\newcommand`, numbering, backward `\eqref`: all work.** Use `tex: { tags: "ams" }` so that only numbering environments (`equation`, `align`) get numbers, as in LaTeX. Macros can also come from config (`tex.macros`).
- **Scope is one note.** `rehype-mathjax` builds a new TeX input jax and document for each file it transforms (`rehype-mathjax/lib/create-plugin.js:220`, `create-renderer.js:30,40`). So numbering restarts and `\newcommand`s don't leak between notes. That's correct for separate notes, but it also means cross-note `\eqref` is impossible this way.
- **Forward references fail** because it converts formula by formula with `document.convert` (`create-renderer.js:45`). MathJax marks such formulas for recompilation (`mathjax-full/js/input/tex/base/BaseMethods.js:917-925`, `Tags.js:203-215`), but only its page pipeline (`document.render()`) acts on that. **Verified fix** (`forward-ref-probe.mjs`): running the whole note through `mathjax.document(html).render()` gives `(2) | a=b (1) | c=d (2)` where per-formula convert gave `(???)`. The same holds on **MathJax 4** (`forward-ref-probe-v4.mjs`, `@mathjax/src` 4.1.3).
- **`mathjax-full` is deprecated.** npm says "Version 4 replaces this package with the scoped package @mathjax/src". `rehype-mathjax` 7.1.0 still depends on `mathjax-full ^3`. MathJax 4 has no `AllPackages`; you import each TeX package you use (`base`, `ams`, `newcommand`, `configmacros`; verified in `forward-ref-probe-v4.mjs`).
- **SVG vs CHTML.** SVG is self-contained: glyphs are inline paths, so there are no fonts to host. The cost is weight: the demo note's HTML is 84 KB with MathJax SVG, against 56 KB with KaTeX (which also needs its CSS and fonts) (verified). CHTML needs `chtml.fontURL`, a hosted font directory (`rehype-mathjax/readme.md:177-186`, read). On GitHub Pages that means copying MathJax fonts into `public/` or using a CDN. Not tried.

### KaTeX via `rehype-katex`: verified (`katex-probe.mjs`)

```
ok   align (CSS-counter number)
FAIL equation+label: Undefined control sequence: \label
FAIL eqref: Undefined control sequence: \eqref
ok   newcommand (same formula)
FAIL newcommand used in a later formula: Undefined control sequence: \half
ok   config macros
globalGroup: later formula sees \half: true [ '\\half' ]
```

- `align` works, and auto-numbers with a CSS counter (`.eqn-num::before { counter-increment: katexEqnNo }`, reset on `body`: `katex/dist/katex.css:1181-1183,1238-1239`). The numbers aren't addressable, and there is no `\label`/`\eqref`/`\ref` in KaTeX's source (`grep` of `katex/src`).
- `rehype-katex` calls `katex.renderToString` once per formula with one shared options object (`rehype-katex/lib/index.js`). A `\newcommand` therefore dies at the end of its formula. With `globalGroup: true` it writes into the shared `macros` object, so it leaks into every later formula **in every note** that processor handles.
- In the full note, KaTeX painted 9 formulas red (verified, `out/katex/demo/`).

**Conclusion:** MathJax is required for `\eqref`, and the per-note document approach is required for forward references.

## 3. Edit-and-preview under `next dev`

Measured with `dev-probe.mjs` against `next dev` (Turbopack) in this container. It opens the dev HMR socket (`/_next/hmr` in Next 16: `next/dist/server/lib/router-server.js`, `isHMRRequest`), edits a marker in the note, waits for messages, then re-fetches.

| Pipeline | First request (cold compile) | Warm request | After editing the note |
|---|---|---|---|
| Plain md, `import.meta.glob` + `type: "text"` rule | 5.2 s (first route compiled) | 236 ms | `serverComponentChanges` pushed **50 ms** after save; reload 233 ms shows the edit |
| `@next/mdx` | 1.9 s | 70 ms | `building` → `serverComponentChanges` **112 ms** after save; reload 154 ms |
| `next-mdx-remote/rsc`, note read with `fs` | 1.3 s | 154 ms | **no HMR message**; a manual reload (134 ms) shows the edit |

- A `serverComponentChanges` message makes an open page re-fetch its Server Component payload, so the edit appears without a reload. I read this from the message type and did not check it in a browser.
- The fs-read note shows edits on reload, because dev re-runs Server Components on each request, but the page never refreshes itself. Turbopack doesn't watch files outside the module graph.
- Plain-Markdown pages re-run the whole remark/rehype/MathJax pipeline on every request: about 135–175 ms of "application-code" for this note, against about 55–95 ms for precompiled `@next/mdx` (from `next dev` request logs). Both are fine for one author. A long note with many formulas will scale roughly linearly. Caching per note text is easy if it ever matters.
- How the `.md` import works: Turbopack `rules` take a module `type`, and `text`/`raw` exports the file as a string (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md:297-339`, added in 16.2.0 per `:445-447`). `import.meta.glob` is Turbopack-only (`08-turbopack.md:170-182`) and returns keys sorted bytewise (`:201`).
- **Gotcha (verified):** `import.meta.glob(…, { eager: true, import: "default" })` returned `undefined` values in 16.4.2, even though the docs show it (`08-turbopack.md:228-238`). `{ eager: true }` and then reading `.default` by hand works (`research/notes-pipeline/lib/notes.ts`).

## 4. Embedding a component and giving it data

The test component is `research/notes-pipeline/components/chart.tsx`, a `"use client"` stand-in for the Chart.js chart. It takes a `data` array, steps through it on click, and writes its props to `data-chart` so the export can be checked.

- **`@next/mdx`** (verified): `<Chart data={[1, 2, 3]} title="jsx" />` in the note. `Chart` comes from the global map in `mdx-components.tsx`, which App Router requires (`mdx.md:85-111, 359-389`), so the note has no `import`. Props are arbitrary JS values. The export carried `[1,2,3]`.
- **`next-mdx-remote/rsc`** (verified): same syntax, components passed as `components={{ Chart }}`. `MDXProvider` isn't available under RSC (`README.md:448`). v6 **blocks JS expressions by default** (`README.md:318, 395-401`), so `data={[1,2,3]}` was silently dropped and the export carried `[]`. `blockJS: false` restores them.
- **Plain Markdown** (verified, `research/notes-pipeline/lib/markdown.tsx`): a ~20-line remark plugin sets `data.hName`/`hProperties` on chosen nodes, and `toJsxRuntime(tree, { components: { chart: ChartEmbed } })` swaps in the React component:
  - `::chart{data="1,2,3" title="directive"}` (remark-directive leaf directive): attributes are **strings only**, so the component parses them. Exported `[1,2,3]`.
  - ```` ```chart ```` fence whose body is JSON: structured data inline. Exported `[4,5,6]`.
  - Only names in the allow-list (`EMBEDS`) become components. Anything else stays plain Markdown, so notes can't import arbitrary code.
  - Larger data (CSV, setup files) would be referenced by name or path and loaded at build time in the server wrapper. That's for the "Images and assets" question on #298, and untested.
- **3D later:** the same hook works. A directive or fence names the scene, and a client wrapper loads the react-three-fiber canvas. Nothing here constrains it.

## 5. Prose with raw LaTeX: what MDX rejects

From `mdx-probe.mjs` (verified, same `@mdx-js/mdx` compiler as both MDX options):

```
ok   less-than in prose              ("If x < y then done.")
FAIL less-than before a letter       ("the set <a, b> of pairs": Unexpected character `,` … in name)
ok   braces in prose                 (compiles, but see below)
FAIL HTML comment                    (to create a comment in MDX, use `{/* text */}`)
ok   maths with braces and <         ($\frac{a}{b} < \{x\}$: math is parsed first)
ok   display maths / LaTeX outside maths / JSX embed
```

Evaluating the output: `the set {1, 2} has two members` renders as `<p>the set 2 has two members</p>`, and `energy {E}` throws `E is not defined` (verified). Plain Markdown leaves all of these as text (`check.mjs`: `lt=true brace=true`).

## 6. What #302 (syntax) and #303 (maths) need to know

Verified with `syntax-probe.mjs` (remark-math 6), unless marked otherwise:

- **`$$` must be on its own lines to be display maths.** `$$ a = b $$` on one line is *inline* maths (the micromark BNF: `math_text ::= sequence_text 1*byte sequence_text` with `sequence_text ::= 1*'$'`, `micromark-extension-math/readme.md:222-234`).
- **A bare `\begin{align}…\end{align}` outside `$$` is just text,** and **`\[ … \]` / `\( … \)` become `[ … ]` / `( … )`** because Markdown eats the backslash escapes. If the author should be able to type raw LaTeX that way, the syntax ticket needs a small remark extension, or has to rule those forms out.
- **`it costs $5 and $10` becomes inline maths `5 and `.** `\$5` is safe. `singleDollarTextMath: false` is the switch if single-dollar maths should go (`remark-math/readme.md:155-158`).
- `tags: "ams"` numbers `equation`/`align` only, as in LaTeX. Plain `$$…$$` gets no number.
- Equation ids look like `mjx-eqn:eq:energy` and `\eqref` renders as a link to them (verified). Cross-note linking (map #298 "Notes index and linking") would need the maths step to know other notes' labels. That's doable, since the build sees every note, but it's a design choice.
- The in-house maths step on MathJax 4: write it as a rehype plugin. It collects the note's math nodes, renders them in one MathJax document so recompilation fixes forward references, splices the output back in, and imports the TeX packages it needs. Under `next build` it runs in a Server Component, so put `@mathjax/src` in `serverExternalPackages` if it hits the same bundling problem as `mathjax-full`. I haven't tried bundling v4.
