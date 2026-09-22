# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Kelvin and labmates at Macroscopic Quantum Optics (MQO), Aalto University, headed by Prof. Anton Zasedatelev. They use the calculators and plotters for real lab work — quick unit/threshold checks during experiments, and visualizing measurement exports (FITS frames, CSV traces) from lab instruments.

Secondary: outside visitors — prospective students, collaborators, and anyone curious about quantum optics who lands on the site to explore the physics, try the calculators/plotters themselves, or encounter it as part of Kelvin's project portfolio. Currently a small audience, but growth into this secondary audience is a hoped-for, not incidental, outcome.

## Product Purpose

A quantum optics lab toolkit that is also the lab's public face. It exists to (1) do real work for MQO's day-to-day lab operations, and (2) represent the group and its physics to outside visitors, doubling as a portfolio piece for Kelvin. Success means labmates actually reach for these tools during experiments, and outside visitors can explore the physics and tools without prior context.

## Positioning

Differentiated on two fronts, held equally:

- **Built for this lab's real instruments and data**, not generic — the calculators use this setup's units and conventions (e.g. LIDT for this optics work, energy-wavelength conversions), and the plotters parse this lab's actual data formats (FITS BEC frames via a custom `@fits-js/core` parser, CSV instrument exports) in ways Origin/MATLAB/Excel/generic web calculators aren't tuned to.
- **Zero-friction browser access** — no install, no license, no MATLAB session. Open a tab, drop a file or type a value, get an answer or a plot immediately.

## Operating Context

Used in two distinct modes: (1) mid-experiment, at a lab computer, for a fast calculation or to eyeball a freshly exported FITS/CSV file; (2) browsing, by someone with no lab context, exploring what MQO does and trying the tools out of curiosity or evaluation (prospective student, collaborator, portfolio viewer).

## Capabilities and Constraints

- **Static hosting is a hard constraint**: deployed as a static export to GitHub Pages (`https://kakitkelvinho.github.io/quop/`). No server, no backend, no API routes — every calculator and plotter must run entirely client-side.
- **Calculators (live)**: energy-wavelength, LIDT (laser-induced damage threshold), light travel time, pace.
- **Plotters (live)**: array plotter, generic CSV plotter, time-axis CSV plotter, FITS plotter, side-by-side CSV+FITS viewer. FITS parsing goes through a custom `@fits-js/core` package; charting via Chart.js.
- **Experiment (live)**: an interactive optical-table builder — place, drag and rotate bench parts on a
  millimetre grid, draw beam paths through them, and read off path length and vacuum time of flight.
  Renders with react-three-fiber; scenes save to JSON and autosave to localStorage.
- **Theory still holds only placeholder copy** — known-incomplete, not a deliberate minimal design.
- Audience is currently small; do not over-engineer for scale, but design and content should hold up if the visitor has never met the lab before.

## Brand Commitments

- Name: **QUOP** — short for **QUantum OPtics**.
- Built for and represents Macroscopic Quantum Optics (MQO), Aalto University, headed by Prof. Anton Zasedatelev.
- Hosted under Kelvin's own GitHub as a static site; also counts as one of Kelvin's portfolio projects.

## Evidence on Hand

- Real lab data committed to the repo: `public/data/bec15.fits` (BEC image data) and `public/data/power15.csv` (instrument export). Use these as real reference data; do not fabricate additional datasets, testimonials, or case studies — none exist on hand.

## Product Principles

1. Static, client-side-only is permanent, not a temporary limitation — no feature can assume a server exists.
2. Real lab correctness comes first: calculators and plotters must handle this lab's actual instruments, units, and data formats correctly before anything else.
3. The same surfaces serve two audiences at once — an insider mid-experiment and an outsider with zero context — so nothing should require lab-internal knowledge to be usable or legible.
4. Friction-free access is part of the value itself: opening a tool should be as fast as the answer it gives.
5. Placeholder sections (Theory, Experiment) are known gaps to fill, not intentionally minimal — don't polish around their bareness as if it were final.
