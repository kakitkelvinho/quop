# Setup file fixtures

One setup file per schema version ever released, in the shape that version
saved. `setup-files.test.ts` checks that each still opens with every
component, beam and connection intact: the promise in
`docs/adr/0001-setup-files-stay-compatible.md`.

v1, v2 and v3 are hand-written. v3 is the first with fibre and cable
connections; v1 and v2 open with none. v1 also carries the beam cube names from
before files were versioned (`beamsplitter`, `pbs-cube`), which open as beam cubes.

- **Bumping the schema version?** Add a migration, then save a setup from the
  new version as `setup-vN.json` and add it to `FIXTURES` in the test.
- **Never edit an existing fixture.** It stands for files people already
  hold; if the test fails on one, the parser is what broke.
