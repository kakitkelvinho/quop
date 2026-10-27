# QUOP

A website which was built to support laboratory work at Macroscopic Quantum Optics (MQO) at Aalto University headed by Prof. Anton Zasedatelev. It is currently hosted as a github static website on [https://kakitkelvinho.github.io/quop/](https://kakitkelvinho.github.io/quop/). 

## Releases

Version 1.0.0 is live! the builder is usable and can be used to sketch out experimental setups, and all the plotters are also usable and have been tested roughly in the lab. Please report any issues if you encounter them! We are also always open to feedback, so also feel free to drop a line to us via email.

## Structure

It is currently divided into 4 sections:

### Builder

The Tabletop (`/builder/tabletop`, the `builder` in code) lets users build an experimental optical setup. There is a virtual optical table and users can drop individual optical components on the table.

### Notes

Coming soon.

### Calculators

Some simple I/Os to quickly calculate different physical concepts to help with back-of-the-envelope calculations. One easter egg calculator on running pace and speed because we are a sporty group :).

### Plotter

Our oscilloscope data are recorded primarily in `.csv`, and our spectrometer data is recorded in `.fits` files. Instead of writing python scripts every time or modifying mathematica notebooks to quickly check our data, we made this so we can quickly visualize the data we have recorded in the lab.

### UI tests

`tests/ui/` holds browser tests written with [Playwright](https://playwright.dev). They build the site, open the homepage, the plotters, the Tabletop and a 404 page in Chromium, once in light and once in dark, and check two things:

- **behaviour**: the page loads, each plotter plots its sample (the status line shows the right row count), and the Time CSV Plotter plots an uploaded file;
- **looks**: a screenshot of each page matches its saved copy in `tests/ui/*-snapshots/`.

CI runs them on every pull request, in the same `ci` check as lint and the unit tests.

**Run them locally**

Fonts render slightly differently on each machine, so the saved screenshots are made in Playwright's Linux Docker image, which renders like CI. With [Docker](https://www.docker.com/) installed, this runs every test exactly as CI does:

```sh
docker run --rm -v "$PWD":/work -v quop-node-modules:/work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble bash -c "npm ci && npm run test:ui"
```

(`quop-node-modules` keeps the container's Linux packages apart from your own `node_modules`.)

Without Docker, check behaviour only and leave the screenshots to CI:

```sh
npm ci
npx playwright install chromium            # once: downloads Playwright's browser
npm run test:ui -- --ignore-snapshots      # builds the site, then runs the tests
```

**After an intended visual change**

A screenshot test fails when a page looks different. When the change is wanted, make new screenshots by adding `-- --update-snapshots` to the Docker command:

```sh
docker run --rm -v "$PWD":/work -v quop-node-modules:/work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble bash -c "npm ci && npm run test:ui -- --update-snapshots"
```

Look at the new images in `tests/ui/*-snapshots/`, then commit them with the change.

**When CI fails**

Open the failed run (the `ci` check on the pull request, then *Summary*), download the `playwright-report` artifact, unzip it, and run `npx playwright show-report <unzipped folder>`. Each failed test lists its error, and a screenshot failure shows the expected, actual and diff images side by side, so you can tell a real change from a bug. Run locally, the same report is in `playwright-report/`.

### Reporting problems

Found something broken or confusing? Use the "Report a problem" link in the footer or on any tool page. This lets you email me directly so I can address the problem.
